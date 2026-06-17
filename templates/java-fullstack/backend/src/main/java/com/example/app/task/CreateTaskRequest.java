package com.example.app.task;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record CreateTaskRequest(
    @NotBlank(message = "title is required")
    String title,
    @NotBlank(message = "description is required")
    String description,
    String assignee,
    String dueAt,
    @Pattern(regexp = "high|medium|low", message = "priority must be high, medium, or low")
    String priority
) {
}
