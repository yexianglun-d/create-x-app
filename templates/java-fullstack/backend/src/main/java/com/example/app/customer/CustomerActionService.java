package com.example.app.customer;

import jakarta.annotation.PostConstruct;
import java.util.Comparator;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CustomerActionService {

    private final CustomerActionRepository customerActionRepository;

    public CustomerActionService(CustomerActionRepository customerActionRepository) {
        this.customerActionRepository = customerActionRepository;
    }

    @PostConstruct
    @Transactional
    public void seedDefaults() {
        if (customerActionRepository.count() > 0) {
            return;
        }

        customerActionRepository.saveAll(List.of(
            new CustomerAction("华东渠道续约", "林夏", CustomerStage.CONTRACT, Priority.HIGH, "补齐采购审批附件", "今天 17:00"),
            new CustomerAction("新门店上线支持", "周南", CustomerStage.PROPOSAL, Priority.MEDIUM, "发送开店物料清单", "明天 10:30"),
            new CustomerAction("季度培训排期", "许岚", CustomerStage.CONTACTED, Priority.LOW, "确认一线主管名单", "周五")
        ));
    }

    public List<CustomerAction> listActions() {
        return customerActionRepository.findAll()
            .stream()
            .sorted(Comparator.comparing(CustomerAction::getCreatedAt).reversed())
            .toList();
    }

    @Transactional
    public CustomerAction createAction(CreateCustomerActionRequest request) {
        CustomerAction action = new CustomerAction(
            request.customerName(),
            normalizeOptional(request.owner(), "待分配"),
            CustomerStage.NEW,
            Priority.fromValue(request.priority()),
            request.nextAction(),
            normalizeOptional(request.dueAt(), "待定")
        );

        return customerActionRepository.save(action);
    }

    private String normalizeOptional(String value, String fallback) {
        if (value == null || value.isBlank()) {
            return fallback;
        }

        return value.trim();
    }
}
