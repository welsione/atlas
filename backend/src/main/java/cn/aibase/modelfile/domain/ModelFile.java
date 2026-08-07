package cn.aibase.modelfile.domain;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 模型文件条目（对应 model_files 表）。
 *
 * <p>一次上传为一个条目：单文件（kind=FILE）或目录（kind=DIRECTORY，zip 上传自动解压）。
 * 磁盘落盘于 {@code {dataDir}/model-files/{id}/}，files 为相对存储根的文件清单。</p>
 */
@Getter
@Setter
@NoArgsConstructor
public class ModelFile {

    private Long id;
    private String name;
    private String category;
    private String description;
    /** FILE / DIRECTORY。 */
    private String kind;
    /** 相对数据目录的存储根（model-files/{id}）。 */
    private String storageRoot;
    /** 固定下载链接的随机凭证（防穷举），创建后不变。 */
    private String token;
    private List<FileEntry> files;
    private long totalSize;
    private int fileCount;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    /** 文件清单条目：相对路径 + 大小 + MD5。 */
    public record FileEntry(String path, long sizeBytes, String checksum) {
    }
}
