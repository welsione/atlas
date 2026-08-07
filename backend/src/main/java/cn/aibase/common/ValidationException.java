package cn.aibase.common;

/**
 * 参数校验异常（400）。
 */
public class ValidationException extends DomainException {

    public ValidationException(String field, String message) {
        super(400, field + ": " + message);
    }
}
