package com.secureinventory.system.repository;

import com.secureinventory.system.entity.Transaction;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface TransactionRepository extends JpaRepository<Transaction, Long> {
    List<Transaction> findByStatus(Transaction.Status status);
}
