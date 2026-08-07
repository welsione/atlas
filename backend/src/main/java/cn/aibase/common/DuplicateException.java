package cn.aibase.common;

/**
 * 重复数据异常（409）。
 */
public class DuplicateException extends DomainException {

    public DuplicateException(String message) {
        super(409, message);
    }
}
