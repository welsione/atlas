package cn.aibase.common;

/**
 * 资源不存在异常（404）。
 */
public class ResourceNotFoundException extends DomainException {

    public ResourceNotFoundException(String resource, Object id) {
        super(404, resource + " 不存在: " + id);
    }
}
