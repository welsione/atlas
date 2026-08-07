package cn.aibase.modelfile.application;

import cn.aibase.common.ValidationException;
import cn.aibase.config.AIBaseProperties;
import cn.aibase.modelfile.domain.ModelFile;
import cn.aibase.modelfile.infrastructure.ModelFileJdbcRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HexFormat;
import java.util.List;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import java.util.zip.ZipOutputStream;

/**
 * 模型文件服务：模型文件/目录的上传（含 zip 解压）、列表、下载（目录打包 zip）与删除。
 *
 * <p>文件落盘于 {@code {dataDir}/model-files/{id}/}，数据库仅记录元数据；
 * 上传路径逐段校验，禁止绝对路径与路径穿越。</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ModelFileService {

    private static final String STORE_DIR = "model-files";
    private static final int MAX_UNZIP_ENTRIES = 20000;
    private static final long MAX_UNZIP_TOTAL = 50L * 1024 * 1024 * 1024;
    private static final int TOKEN_LENGTH = 32;
    /** 每 IP 每分钟下载次数上限（防攻击）。 */
    private static final int RATE_LIMIT_PER_MINUTE = 60;

    private final ModelFileJdbcRepository repository;
    private final AIBaseProperties properties;
    private final java.security.SecureRandom secureRandom = new java.security.SecureRandom();

    @Transactional(readOnly = true)
    public List<ModelFile> list() {
        return repository.findAll();
    }

    @Transactional(readOnly = true)
    public ModelFile get(Long id) {
        return repository.findById(id);
    }

    /**
     * 按固定下载 token 查询条目（公开下载入口）。
     */
    public ModelFile getByToken(String token) {
        return ensureContentHash(repository.findByToken(token));
    }

    /**
     * 生成固定下载链接（随机 token，防穷举；创建后不变）。
     */
    public String downloadLink(String token) {
        return "/api/files/" + token + "/download";
    }

    /**
     * 批量上传文件（同一模型条目）；第一个文件名为条目名。
     * 单文件上传时若为 .zip 且含多个条目，自动解压为目录条目。
     *
     * @param updateToken 非空时更新已有条目（替换内容、版本自增、重新计算哈希），链接/token 不变
     */
    public ModelFile upload(String category, String description, List<MultipartFile> files, String updateToken) {
        if (files == null || files.isEmpty()) {
            throw new ValidationException("files", "请选择要上传的文件");
        }
        String name = stripName(files.get(0).getOriginalFilename());
        if (name.isBlank()) {
            throw new ValidationException("files", "文件名不能为空");
        }
        // 目录上传：浏览器 webkitdirectory 上传时第一段为目录名，且多于一个文件
        boolean isDirectory = files.size() > 1;
        String displayName = isDirectory ? firstSegment(name) : name;

        ModelFile entry = new ModelFile();
        if (updateToken != null && !updateToken.isBlank()) {
            entry = repository.findByToken(updateToken);
        }
        entry.setName(displayName);
        entry.setCategory(category == null || category.isBlank() ? "default" : category.trim());
        entry.setDescription(description == null ? "" : description);
        entry.setKind("FILE");
        entry.setStorageRoot(entry.getStorageRoot() == null ? "" : entry.getStorageRoot());
        if (entry.getToken() == null || entry.getToken().isBlank()) {
            entry.setToken(newToken());
        }
        if (entry.getContentHash() == null) {
            entry.setContentHash("");
        }
        entry.setFiles(new ArrayList<>());
        entry.setUpdatedAt(LocalDateTime.now());
        if (entry.getId() == null) {
            entry.setCreatedAt(entry.getUpdatedAt());
            repository.insert(entry);
            entry.setStorageRoot(STORE_DIR + "/" + entry.getId());
            repository.update(entry);
        }

        Path root = storeRoot(entry.getId());
        try {
            // 更新模式：先清空旧文件，再写入新内容
            if (updateToken != null && !updateToken.isBlank()) {
                deleteStore(root);
                Files.createDirectories(root);
            }
            if (files.size() == 1 && isZip(name)) {
                // 单 zip 上传：解压为目录条目
                unzip(entry, files.get(0), root);
            } else {
                for (MultipartFile file : files) {
                    String relPath = sanitizeRelPath(file.getOriginalFilename());
                    writeFile(entry, root, relPath, file);
                }
            }
            if (entry.getFiles().isEmpty()) {
                throw new ValidationException("files", "没有可保存的文件");
            }
            entry.setKind(isDirectory || entry.getFiles().size() > 1 ? "DIRECTORY" : "FILE");
            if (entry.getKind().equals("DIRECTORY")) {
                entry.getFiles().sort(Comparator.comparing(ModelFile.FileEntry::path));
            }
            entry.setTotalSize(entry.getFiles().stream().mapToLong(ModelFile.FileEntry::sizeBytes).sum());
            entry.setFileCount(entry.getFiles().size());
            entry.setVersion(entry.getVersion() + 1);
            entry.setContentHash(computeContentHash(entry));
            repository.update(entry);
            log.info("模型文件{}：id={}，name={}，kind={}，files={}，size={}，version={}，hash={}",
                    updateToken != null && !updateToken.isBlank() ? "更新" : "上传",
                    entry.getId(), entry.getName(), entry.getKind(), entry.getFileCount(), entry.getTotalSize(),
                    entry.getVersion(), entry.getContentHash().substring(0, Math.min(12, entry.getContentHash().length())));
            return entry;
        } catch (Exception ex) {
            if (updateToken == null || updateToken.isBlank()) {
                deleteStore(root);
                repository.delete(entry.getId());
            }
            if (ex instanceof ValidationException ve) {
                throw ve;
            }
            throw new IllegalStateException("模型文件保存失败: " + ex.getMessage(), ex);
        }
    }

    @Transactional
    public void delete(Long id) {
        ModelFile entry = repository.findById(id);
        repository.delete(id);
        deleteStore(storeRoot(id));
        log.info("删除模型文件：id={}，name={}", id, entry.getName());
    }

    /**
     * 下载：单文件直接流式输出；目录打包为 zip 流式输出。
     */
    public void download(Long id, OutputStream out) throws IOException {
        ModelFile entry = repository.findById(id);
        Path root = storeRoot(id);
        if (entry.getKind().equals("DIRECTORY") || entry.getFiles().size() > 1) {
            zipDirectory(entry, root, out);
        } else {
            Path file = root.resolve(entry.getFiles().get(0).path());
            Files.copy(file, out);
        }
    }

    /**
     * 记录一次公开下载：写入下载日志 + 累计计数。
     * 返回 false 表示触发限流（该 IP 每分钟下载次数超限）。
     */
    @Transactional
    public boolean recordDownload(ModelFile entry, String ip, String userAgent) {
        String clientIp = normalizeIp(ip);
        String minuteWindow = LocalDateTime.now().minusMinutes(1)
                .format(java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));
        int recent = repository.countDownloadsByIpSince(clientIp, minuteWindow);
        if (recent >= RATE_LIMIT_PER_MINUTE) {
            log.warn("下载限流：ip={}，entry={}，最近 1 分钟 {} 次", clientIp, entry.getId(), recent);
            return false;
        }
        repository.insertDownloadLog(entry.getId(), clientIp, userAgent == null ? "" : userAgent, LocalDateTime.now());
        repository.incrementDownloadCount(entry.getId());
        return true;
    }

    /**
     * 下载元数据（轻量校验接口）：版本号 + 内容哈希 + 大小 + 更新时间 + 下载次数。
     * 客户端先查 meta 判断"是否更新"，一致则跳过下载。
     */
    public ModelMeta meta(String token) {
        ModelFile entry = ensureContentHash(repository.findByToken(token));
        return new ModelMeta(entry.getVersion(), entry.getContentHash(), entry.getTotalSize(),
                entry.getFileCount(), entry.getDownloadCount(), entry.getUpdatedAt());
    }

    /** 惰性回填：历史条目（旧库升级）content_hash 为空时按当前内容计算并落库。 */
    private ModelFile ensureContentHash(ModelFile entry) {
        if (entry.getContentHash() == null || entry.getContentHash().isBlank()) {
            entry.setContentHash(computeContentHash(entry));
            repository.update(entry);
            log.info("已为条目 {} 回填内容哈希 {}", entry.getId(), entry.getContentHash().substring(0, 12));
        }
        return entry;
    }

    /** 查询条目下载日志（管理端）。 */
    public List<java.util.Map<String, Object>> downloadLogs(Long id, int limit) {
        repository.findById(id);
        return repository.findDownloadLogs(id, limit);
    }

    /**
     * 内容哈希：单文件为文件内容 SHA-256；目录为文件清单（path+size+md5 排序拼接）的 SHA-256。
     * 内容不变则哈希稳定，客户端据此判断是否有更新。
     */
    private String computeContentHash(ModelFile entry) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            if (entry.getFiles().size() == 1) {
                Path file = storeRoot(entry.getId()).resolve(entry.getFiles().get(0).path());
                try (InputStream in = Files.newInputStream(file)) {
                    byte[] buf = new byte[8192];
                    int n;
                    while ((n = in.read(buf)) > 0) {
                        md.update(buf, 0, n);
                    }
                }
            } else {
                for (ModelFile.FileEntry fe : entry.getFiles()) {
                    md.update(fe.path().getBytes(java.nio.charset.StandardCharsets.UTF_8));
                    md.update((byte) 0);
                    md.update(String.valueOf(fe.sizeBytes()).getBytes(java.nio.charset.StandardCharsets.UTF_8));
                    md.update((byte) 0);
                    md.update(fe.checksum().getBytes(java.nio.charset.StandardCharsets.UTF_8));
                    md.update((byte) 0);
                }
            }
            return HexFormat.of().formatHex(md.digest());
        } catch (Exception ex) {
            throw new IllegalStateException("内容哈希计算失败", ex);
        }
    }

    private String normalizeIp(String ip) {
        if (ip == null || ip.isBlank()) {
            return "unknown";
        }
        // 代理链取第一个真实 IP
        int comma = ip.indexOf(',');
        return (comma > 0 ? ip.substring(0, comma) : ip).trim();
    }

    public String downloadFileName(ModelFile entry) {
        if (entry.getKind().equals("DIRECTORY") || entry.getFiles().size() > 1) {
            return entry.getName() + ".zip";
        }
        return Paths.get(entry.getFiles().get(0).path()).getFileName().toString();
    }

    /** 下载元数据（meta 接口返回）。 */
    public record ModelMeta(int version, String contentHash, long totalSize, int fileCount,
                            long downloadCount, LocalDateTime updatedAt) {
    }

    /** 上传校验与写盘：逐文件计算 MD5、大小，追加文件清单。 */
    private void writeFile(ModelFile entry, Path root, String relPath, MultipartFile file) throws IOException {
        Path target = root.resolve(relPath).normalize();
        if (!target.startsWith(root)) {
            throw new ValidationException("files", "非法文件路径: " + relPath);
        }
        Files.createDirectories(target.getParent());
        try (InputStream in = file.getInputStream()) {
            long size = Files.copy(in, target);
            String checksum = checksum(target);
            entry.getFiles().add(new ModelFile.FileEntry(relPath, size, checksum));
        }
    }

    /** zip 解压为目录条目（防御 zip 炸弹：条目数/总大小上限，路径穿越校验）。 */
    private void unzip(ModelFile entry, MultipartFile zip, Path root) throws IOException {
        String topSegment = firstSegment(stripName(zip.getOriginalFilename()));
        if (topSegment.toLowerCase().endsWith(".zip")) {
            topSegment = topSegment.substring(0, topSegment.length() - 4);
        }
        long total = 0;
        int count = 0;
        try (ZipInputStream zis = new ZipInputStream(zip.getInputStream())) {
            ZipEntry ze;
            while ((ze = zis.getNextEntry()) != null) {
                if (ze.isDirectory()) {
                    continue;
                }
                if (++count > MAX_UNZIP_ENTRIES) {
                    throw new ValidationException("files", "zip 文件条目过多（> " + MAX_UNZIP_ENTRIES + "）");
                }
                total += ze.getSize();
                if (total > MAX_UNZIP_TOTAL) {
                    throw new ValidationException("files", "zip 解压后体积过大");
                }
                String relPath = sanitizeRelPath(ze.getName());
                Path target = root.resolve(relPath).normalize();
                if (!target.startsWith(root)) {
                    throw new ValidationException("files", "zip 内含非法路径: " + ze.getName());
                }
                Files.createDirectories(target.getParent());
                long size = Files.copy(zis, target);
                entry.getFiles().add(new ModelFile.FileEntry(relPath, size, checksum(target)));
            }
        }
        entry.setName(topSegment);
        entry.setKind("DIRECTORY");
    }

    private void zipDirectory(ModelFile entry, Path root, OutputStream out) throws IOException {
        try (ZipOutputStream zos = new ZipOutputStream(out)) {
            for (ModelFile.FileEntry fe : entry.getFiles()) {
                Path file = root.resolve(fe.path()).normalize();
                if (!file.startsWith(root) || !Files.isRegularFile(file)) {
                    continue;
                }
                zos.putNextEntry(new ZipEntry(fe.path()));
                Files.copy(file, zos);
                zos.closeEntry();
            }
        }
    }

    /** 上传文件名的相对路径校验：逐段验证，禁止 .. 与绝对路径。 */
    private String sanitizeRelPath(String originalName) {
        if (originalName == null || originalName.isBlank()) {
            throw new ValidationException("files", "文件名不能为空");
        }
        String normalized = originalName.replace('\\', '/');
        Path path = Paths.get(normalized);
        for (Path segment : path) {
            String s = segment.toString();
            if (s.equals("..") || s.equals(".") || s.isEmpty()) {
                throw new ValidationException("files", "非法文件路径: " + originalName);
            }
        }
        if (path.isAbsolute()) {
            throw new ValidationException("files", "不支持绝对路径: " + originalName);
        }
        return normalized;
    }

    private Path storeRoot(Long id) {
        return Path.of(properties.getDataDir()).normalize().resolve(STORE_DIR).resolve(String.valueOf(id));
    }

    private void deleteStore(Path root) {
        try {
            if (Files.exists(root)) {
                try (var walk = Files.walk(root)) {
                    walk.sorted(Comparator.reverseOrder()).forEach(p -> {
                        try {
                            Files.deleteIfExists(p);
                        } catch (IOException ignored) {
                        }
                    });
                }
            }
        } catch (IOException ex) {
            log.warn("清理存储目录失败: {}", root, ex);
        }
    }

    private String stripName(String name) {
        return name == null ? "" : name.replace('\\', '/');
    }

    private String firstSegment(String name) {
        int idx = name.indexOf('/');
        return idx > 0 ? name.substring(0, idx) : name;
    }

    private boolean isZip(String name) {
        return name.toLowerCase().endsWith(".zip");
    }

    private String checksum(Path file) throws IOException {
        MessageDigest md;
        try {
            md = MessageDigest.getInstance("MD5");
        } catch (Exception ex) {
            throw new IllegalStateException("MD5 不可用", ex);
        }
        try (InputStream in = Files.newInputStream(file)) {
            byte[] buf = new byte[8192];
            int n;
            while ((n = in.read(buf)) > 0) {
                md.update(buf, 0, n);
            }
        }
        return HexFormat.of().formatHex(md.digest());
    }

    /** 生成随机下载 token：32 字节安全随机数 hex（不可穷举）。 */
    private String newToken() {
        byte[] bytes = new byte[TOKEN_LENGTH];
        secureRandom.nextBytes(bytes);
        return HexFormat.of().formatHex(bytes);
    }
}
