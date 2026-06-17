package com.example.app.task;

import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
public class Task {

    @Id
    private String id;

    private String title;

    private String assignee;

    @Enumerated(EnumType.STRING)
    private TaskStatus status;

    @Enumerated(EnumType.STRING)
    private Priority priority;

    private String description;

    private String dueAt;

    private OffsetDateTime createdAt;

    protected Task() {
    }

    public Task(String title, String assignee, TaskStatus status, Priority priority, String description, String dueAt) {
        this.id = UUID.randomUUID().toString();
        this.title = title;
        this.assignee = assignee;
        this.status = status;
        this.priority = priority;
        this.description = description;
        this.dueAt = dueAt;
        this.createdAt = OffsetDateTime.now();
    }

    public String getId() {
        return id;
    }

    public String getTitle() {
        return title;
    }

    public String getAssignee() {
        return assignee;
    }

    public TaskStatus getStatus() {
        return status;
    }

    public Priority getPriority() {
        return priority;
    }

    public String getDescription() {
        return description;
    }

    public String getDueAt() {
        return dueAt;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }
}
