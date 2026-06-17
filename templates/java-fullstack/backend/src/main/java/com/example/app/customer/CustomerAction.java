package com.example.app.customer;

import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
public class CustomerAction {

    @Id
    private String id;

    private String customerName;

    private String owner;

    @Enumerated(EnumType.STRING)
    private CustomerStage stage;

    @Enumerated(EnumType.STRING)
    private Priority priority;

    private String nextAction;

    private String dueAt;

    private OffsetDateTime createdAt;

    protected CustomerAction() {
    }

    public CustomerAction(String customerName, String owner, CustomerStage stage, Priority priority, String nextAction, String dueAt) {
        this.id = UUID.randomUUID().toString();
        this.customerName = customerName;
        this.owner = owner;
        this.stage = stage;
        this.priority = priority;
        this.nextAction = nextAction;
        this.dueAt = dueAt;
        this.createdAt = OffsetDateTime.now();
    }

    public String getId() {
        return id;
    }

    public String getCustomerName() {
        return customerName;
    }

    public String getOwner() {
        return owner;
    }

    public CustomerStage getStage() {
        return stage;
    }

    public Priority getPriority() {
        return priority;
    }

    public String getNextAction() {
        return nextAction;
    }

    public String getDueAt() {
        return dueAt;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }
}
