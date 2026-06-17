package com.example.app.customer;

import com.example.app.common.ApiResponse;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/customer-actions")
public class CustomerActionController {

    private final CustomerActionService customerActionService;

    public CustomerActionController(CustomerActionService customerActionService) {
        this.customerActionService = customerActionService;
    }

    @GetMapping
    public ApiResponse<List<CustomerAction>> listActions() {
        return ApiResponse.ok(customerActionService.listActions(), "loaded");
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<CustomerAction> createAction(@Valid @RequestBody CreateCustomerActionRequest request) {
        return ApiResponse.ok(customerActionService.createAction(request), "created");
    }
}
