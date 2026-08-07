package cn.aibase.common;

/**
 * 领域异常基类：Service 层只抛领域异常，由 GlobalExceptionHandler 统一转 HTTP 响应。
 */
public abstract class DomainException extends RuntimeException {

    private final int status;

    protected DomainException(int status, String message) {
        super(message);
        this.status = status;
    }

    public int getStatus() {
        return status;
    }
}
