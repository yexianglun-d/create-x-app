package com.example.app.customer;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record CreateCustomerActionRequest(
    @NotBlank(message = "customerName is required")
    String customerName,
    @NotBlank(message = "nextAction is required")
    String nextAction,
    String owner,
    String dueAt,
    @Pattern(regexp = "high|medium|low", message = "priority must be high, medium, or low")
    String priority
) {
}
