package com.secureinventory.system.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "transactions")
public class Transaction {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "product_item_id")
    @JsonIgnoreProperties("product")
    private ProductItem productItem;

    @Column
    private String batchId;

    @Column
    private String issuerName;

    @Column
    private String extraAccessories;

    @ManyToOne(optional = false)
    @JoinColumn(name = "officer_id")
    private Officer officer;

    @Column(nullable = false)
    private int quantity;

    @Column(nullable = false)
    private int returnedQuantity = 0;

    @Column(nullable = false)
    private LocalDateTime issuedAt = LocalDateTime.now();

    private LocalDateTime returnedAt;

    @Column
    private String purpose;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Status status = Status.ISSUED;

    @Column
    private boolean isDamaged = false;

    @Column
    private String damagePhotoUrl;

    @Column(columnDefinition = "TEXT")
    private String missingSpares;

    public enum Status {
        ISSUED, RETURNED, PARTIALLY_RETURNED
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public ProductItem getProductItem() {
        return productItem;
    }

    public void setProductItem(ProductItem productItem) {
        this.productItem = productItem;
    }

    public String getBatchId() {
        return batchId;
    }

    public void setBatchId(String batchId) {
        this.batchId = batchId;
    }

    public String getIssuerName() {
        return issuerName;
    }

    public void setIssuerName(String issuerName) {
        this.issuerName = issuerName;
    }

    public String getExtraAccessories() {
        return extraAccessories;
    }

    public void setExtraAccessories(String extraAccessories) {
        this.extraAccessories = extraAccessories;
    }

    public Officer getOfficer() {
        return officer;
    }

    public void setOfficer(Officer officer) {
        this.officer = officer;
    }

    public void setQuantity(int quantity) {
        this.quantity = quantity;
    }

    public LocalDateTime getIssuedAt() {
        return issuedAt;
    }

    public void setIssuedAt(LocalDateTime issuedAt) {
        this.issuedAt = issuedAt;
    }

    public LocalDateTime getReturnedAt() {
        return returnedAt;
    }

    public void setReturnedAt(LocalDateTime returnedAt) {
        this.returnedAt = returnedAt;
    }

    public String getPurpose() {
        return purpose;
    }

    public void setPurpose(String purpose) {
        this.purpose = purpose;
    }

    public Status getStatus() {
        return status;
    }

    public void setStatus(Status status) {
        this.status = status;
    }

    public int getReturnedQuantity() {
        return returnedQuantity;
    }

    public void setReturnedQuantity(int returnedQuantity) {
        this.returnedQuantity = returnedQuantity;
    }

    public boolean isDamaged() {
        return isDamaged;
    }

    public void setDamaged(boolean damaged) {
        isDamaged = damaged;
    }

    public String getDamagePhotoUrl() {
        return damagePhotoUrl;
    }

    public void setDamagePhotoUrl(String damagePhotoUrl) {
        this.damagePhotoUrl = damagePhotoUrl;
    }

    public String getMissingSpares() {
        return missingSpares;
    }

    public void setMissingSpares(String missingSpares) {
        this.missingSpares = missingSpares;
    }
}
