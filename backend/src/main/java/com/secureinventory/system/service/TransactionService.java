package com.secureinventory.system.service;

import com.secureinventory.system.entity.*;
import com.secureinventory.system.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
public class TransactionService {

    @Autowired
    private TransactionRepository transactionRepository;

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private ProductItemRepository productItemRepository;

    @Autowired
    private OfficerRepository officerRepository;

    @Autowired
    private AuditLogService auditLogService;

    @Transactional
    public List<Transaction> issueBatch(com.secureinventory.system.dto.InventoryDtos.IssueRequest request) {
        Officer officer = officerRepository.findByBadgeNumber(request.getBadgeNumber())
                .orElseGet(() -> {
                    Officer newOfficer = new Officer();
                    newOfficer.setBadgeNumber(request.getBadgeNumber());
                    return newOfficer;
                });

        if (request.getName() != null) officer.setName(request.getName());
        if (request.getDepartment() != null) officer.setDepartment(request.getDepartment());
        if (request.getPhone() != null) officer.setPhone(request.getPhone());
        if (request.getOthers() != null) officer.setOthers(request.getOthers());
        officerRepository.save(officer);

        String batchId = UUID.randomUUID().toString();
        List<Transaction> transactions = new ArrayList<>();

        for (String barcode : request.getBarcodes()) {
            ProductItem item = productItemRepository.findByBarcode(barcode)
                    .orElseThrow(() -> new RuntimeException("Item with barcode " + barcode + " not found"));

            if (item.getStatus() != ProductItem.Status.AVAILABLE) {
                throw new RuntimeException("Item " + barcode + " is not available (Status: " + item.getStatus() + ")");
            }

            // Update item status
            item.setStatus(ProductItem.Status.ISSUED);
            item.setLastOfficerName(officer.getName());
            item.setLastOfficerBadgeNumber(officer.getBadgeNumber());
            productItemRepository.save(item);

            // Update derived product counters
            Product product = item.getProduct();
            product.setAvailableQuantity(product.getAvailableQuantity() - 1);
            productRepository.save(product);

            Transaction transaction = new Transaction();
            transaction.setProductItem(item);
            transaction.setOfficer(officer);
            transaction.setQuantity(1);
            transaction.setPurpose(request.getPurpose());
            transaction.setBatchId(batchId);
            transaction.setIssuerName(request.getIssuerName());
            transaction.setExtraAccessories(request.getExtraAccessories());
            transaction.setStatus(Transaction.Status.ISSUED);
            
            transactions.add(transactionRepository.save(transaction));
        }

        auditLogService.log("STOCK_ISSUE", "Issued batch " + batchId + " (" + request.getBarcodes().size() + " items) to " + officer.getName());
        return transactions;
    }

    @Transactional
    public void returnProduct(Long transactionId, int quantityToReturn, Transaction.Status overrideStatus) {
        Transaction transaction = transactionRepository.findById(transactionId)
                .orElseThrow(() -> new RuntimeException("Transaction not found"));

        if (transaction.getStatus() == Transaction.Status.RETURNED) {
            throw new RuntimeException("Already returned");
        }

        ProductItem item = transaction.getProductItem();
        item.setStatus(ProductItem.Status.AVAILABLE);
        
        // Clear officer name only when fully returned
        if (overrideStatus == null || overrideStatus == Transaction.Status.RETURNED) {
            item.setLastOfficerName(null);
            item.setLastOfficerBadgeNumber(null);
        } else {
            // Keep current officer name if partially returned
            item.setLastOfficerName(transaction.getOfficer().getName());
            item.setLastOfficerBadgeNumber(transaction.getOfficer().getBadgeNumber());
        }
        productItemRepository.save(item);

        Product product = item.getProduct();
        product.setAvailableQuantity(product.getAvailableQuantity() + 1);
        productRepository.save(product);

        transaction.setReturnedQuantity(1);
        transaction.setReturnedAt(LocalDateTime.now());
        transaction.setStatus(overrideStatus != null ? overrideStatus : Transaction.Status.RETURNED);
        transactionRepository.save(transaction);

        auditLogService.log("STOCK_RETURN", "Returned " + item.getBarcode() + " (Status: " + transaction.getStatus() + ") from " + transaction.getOfficer().getName());
    }

    @Transactional
    public void returnProductDetailed(Long transactionId, com.secureinventory.system.dto.InventoryDtos.DetailedReturnRequest request) {
        Transaction transaction = transactionRepository.findById(transactionId)
                .orElseThrow(() -> new RuntimeException("Transaction not found"));

        if (transaction.getStatus() == Transaction.Status.RETURNED) {
            throw new RuntimeException("Already returned");
        }

        ProductItem item = transaction.getProductItem();
        Product product = item.getProduct();

        // 1. Update Transaction Details
        transaction.setDamaged(request.isDamaged());
        transaction.setDamagePhotoUrl(request.getDamagePhotoUrl());
        transaction.setMissingSpares(request.getMissingSpares());
        transaction.setReturnedAt(LocalDateTime.now());
        transaction.setReturnedQuantity(1);

        // 2. Determine Status
        boolean isPartiallyReturned = request.getMissingSpares() != null && !request.getMissingSpares().isEmpty();
        
        if (request.isDamaged()) {
            item.setStatus(ProductItem.Status.DAMAGED);
            transaction.setStatus(Transaction.Status.RETURNED); 
        } else if (isPartiallyReturned) {
            item.setStatus(ProductItem.Status.PARTIALLY_RETURNED);
            transaction.setStatus(Transaction.Status.PARTIALLY_RETURNED);
        } else {
            item.setStatus(ProductItem.Status.AVAILABLE);
            transaction.setStatus(Transaction.Status.RETURNED);
        }

        // 3. Update Product Stats
        if (item.getStatus() == ProductItem.Status.AVAILABLE) {
            product.setAvailableQuantity(product.getAvailableQuantity() + 1);
        }
        // If it's DAMAGED, available quantity does NOT increase (or we could use a different counter, but the user says it can't be issued)
        // Existing logic for availableQuantity assumes it's only for items ready to be issued.
        productRepository.save(product);

        // 4. Update Item Metadata
        if (transaction.getStatus() == Transaction.Status.RETURNED) {
            // If fully returned and NOT damaged, clear officer? 
            // User might want to keep history of who damaged it.
            // Let's keep officer info if it's damaged.
            if (!request.isDamaged()) {
                item.setLastOfficerName(null);
                item.setLastOfficerBadgeNumber(null);
            }
        } else {
            item.setLastOfficerName(transaction.getOfficer().getName());
            item.setLastOfficerBadgeNumber(transaction.getOfficer().getBadgeNumber());
        }

        productItemRepository.save(item);
        transactionRepository.save(transaction);

        auditLogService.log("STOCK_RETURN_DETAILED", "Returned " + item.getBarcode() + " (Damaged: " + request.isDamaged() + ", Partial: " + isPartiallyReturned + ") from " + transaction.getOfficer().getName());
    }

    public List<Transaction> getPendingReturns() {
        return transactionRepository.findAll().stream()
                .filter(t -> t.getStatus() != Transaction.Status.RETURNED)
                .sorted((a, b) -> b.getIssuedAt().compareTo(a.getIssuedAt()))
                .toList();
    }

    public List<Transaction> getAllTransactions() {
        return transactionRepository.findAll().stream()
                .sorted((a, b) -> b.getIssuedAt().compareTo(a.getIssuedAt()))
                .toList();
    }

    @Transactional
    public void deleteTransaction(Long id) {
        transactionRepository.findById(id).ifPresent(transaction -> {
            if (transaction.getStatus() != Transaction.Status.RETURNED) {
                // If the item wasn't returned yet, revert it to available
                ProductItem item = transaction.getProductItem();
                if (item != null) {
                    item.setStatus(ProductItem.Status.AVAILABLE);
                    item.setLastOfficerName(null);
                    item.setLastOfficerBadgeNumber(null);
                    productItemRepository.save(item);

                    Product product = item.getProduct();
                    if (product != null) {
                        product.setAvailableQuantity(product.getAvailableQuantity() + 1);
                        productRepository.save(product);
                    }
                }
            }
            transactionRepository.delete(transaction);
        });
    }

    @Transactional
    public void clearAllTransactions() {
        transactionRepository.deleteAll();
    }
}
