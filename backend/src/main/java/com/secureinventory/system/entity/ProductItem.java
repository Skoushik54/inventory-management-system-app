package com.secureinventory.system.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;

@Entity
@Table(name = "product_items")
public class ProductItem {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String barcode;

    @ManyToOne(optional = false)
    @JoinColumn(name = "product_id")
    @JsonIgnoreProperties({"items", "spareParts"})
    private Product product;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Status status = Status.AVAILABLE;

    @Column
    private String lastOfficerName;

    @Column
    private String lastOfficerBadgeNumber;

    @Column
    private String serialNumber;

    public enum Status {
        AVAILABLE, ISSUED, DAMAGED, PARTIALLY_RETURNED
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getBarcode() {
        return barcode;
    }

    public void setBarcode(String barcode) {
        this.barcode = barcode;
    }

    public Product getProduct() {
        return product;
    }

    public void setProduct(Product product) {
        this.product = product;
    }

    public Status getStatus() {
        return status;
    }

    public void setStatus(Status status) {
        this.status = status;
    }

    public String getLastOfficerName() {
        return lastOfficerName;
    }

    public void setLastOfficerName(String lastOfficerName) {
        this.lastOfficerName = lastOfficerName;
    }

    public String getLastOfficerBadgeNumber() {
        return lastOfficerBadgeNumber;
    }

    public void setLastOfficerBadgeNumber(String lastOfficerBadgeNumber) {
        this.lastOfficerBadgeNumber = lastOfficerBadgeNumber;
    }

    public String getSerialNumber() {
        return serialNumber;
    }

    public void setSerialNumber(String serialNumber) {
        this.serialNumber = serialNumber;
    }
}
