package com.example.app.customer;

import org.springframework.data.jpa.repository.JpaRepository;

public interface CustomerActionRepository extends JpaRepository<CustomerAction, String> {
}
