package com.example.app.common;

public record ApiResponse<T>(int code, T data, String message) {

    public static <T> ApiResponse<T> ok(T data, String message) {
        return new ApiResponse<>(0, data, message);
    }
}
