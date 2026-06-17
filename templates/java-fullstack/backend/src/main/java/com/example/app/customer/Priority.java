package com.example.app.customer;

public enum Priority {
    HIGH,
    MEDIUM,
    LOW;

    public static Priority fromValue(String value) {
        if (value == null || value.isBlank()) {
            return MEDIUM;
        }

        return Priority.valueOf(value.trim().toUpperCase());
    }
}
