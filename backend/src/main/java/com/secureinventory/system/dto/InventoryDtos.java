package com.secureinventory.system.dto;

import java.time.LocalDateTime;
import java.util.List;

public class InventoryDtos {

    public static class LoginRequest {
        private String username;
        private String password;

        public String getUsername() {
            return username;
        }

        public void setUsername(String username) {
            this.username = username;
        }

        public String getPassword() {
            return password;
        }

        public void setPassword(String password) {
            this.password = password;
        }
    }

    public static class LoginResponse {
        private String token;
        private String username;

        public String getToken() {
            return token;
        }

        public void setToken(String token) {
            this.token = token;
        }

        public String getUsername() {
            return username;
        }

        public void setUsername(String username) {
            this.username = username;
        }
    }

    public static class ProductRequest {
        private String name;
        private String barcode;
        private int totalQuantity;

        public String getName() {
            return name;
        }

        public void setName(String name) {
            this.name = name;
        }

        public String getBarcode() {
            return barcode;
        }

        public void setBarcode(String barcode) {
            this.barcode = barcode;
        }

        public int getTotalQuantity() {
            return totalQuantity;
        }

        public void setTotalQuantity(int totalQuantity) {
            this.totalQuantity = totalQuantity;
        }
    }

    public static class IssueRequest {
        private List<String> barcodes; // Changed from single barcode to list of item barcodes
        private String badgeNumber;
        private String name;
        private String department;
        private String phone;
        private String others;
        private String purpose;
        private String issuerName;
        private String extraAccessories;

        public List<String> getBarcodes() { return barcodes; }
        public void setBarcodes(List<String> barcodes) { this.barcodes = barcodes; }
        public String getBadgeNumber() { return badgeNumber; }
        public void setBadgeNumber(String badgeNumber) { this.badgeNumber = badgeNumber; }
        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
        public String getDepartment() { return department; }
        public void setDepartment(String department) { this.department = department; }
        public String getPhone() { return phone; }
        public void setPhone(String phone) { this.phone = phone; }
        public String getOthers() { return others; }
        public void setOthers(String others) { this.others = others; }
        public String getPurpose() { return purpose; }
        public void setPurpose(String purpose) { this.purpose = purpose; }
        public String getIssuerName() { return issuerName; }
        public void setIssuerName(String issuerName) { this.issuerName = issuerName; }
        public String getExtraAccessories() { return extraAccessories; }
        public void setExtraAccessories(String extraAccessories) { this.extraAccessories = extraAccessories; }
    }

    public static class ReturnRequest {
        private String barcode;
        private String badgeNumber;

        public String getBarcode() {
            return barcode;
        }

        public void setBarcode(String barcode) {
            this.barcode = barcode;
        }

        public String getBadgeNumber() {
            return badgeNumber;
        }

        public void setBadgeNumber(String badgeNumber) {
            this.badgeNumber = badgeNumber;
        }
    }

    public static class DetailedReturnRequest {
        @com.fasterxml.jackson.annotation.JsonProperty("isDamaged")
        private boolean isDamaged;
        private String damagePhotoUrl;
        private String missingSpares;

        public boolean isDamaged() { return isDamaged; }
        public void setDamaged(boolean damaged) { isDamaged = damaged; }
        public String getDamagePhotoUrl() { return damagePhotoUrl; }
        public void setDamagePhotoUrl(String damagePhotoUrl) { this.damagePhotoUrl = damagePhotoUrl; }
        public String getMissingSpares() { return missingSpares; }
        public void setMissingSpares(String missingSpares) { this.missingSpares = missingSpares; }
    }

    public static class OfficerRequest {
        private String name;
        private String badgeNumber;
        private String department;
        private String phone;

        public String getName() {
            return name;
        }

        public void setName(String name) {
            this.name = name;
        }

        public String getBadgeNumber() {
            return badgeNumber;
        }

        public void setBadgeNumber(String badgeNumber) {
            this.badgeNumber = badgeNumber;
        }

        public String getDepartment() {
            return department;
        }

        public void setDepartment(String department) {
            this.department = department;
        }

        public String getPhone() {
            return phone;
        }

        public void setPhone(String phone) {
            this.phone = phone;
        }
    }

    public static class SummaryResponse {
        private long totalProducts;
        private long availableStock;
        private long issuedItems;
        private long pendingReturns;
        private long damagedItems;

        public long getTotalProducts() { return totalProducts; }
        public void setTotalProducts(long totalProducts) { this.totalProducts = totalProducts; }
        public long getAvailableStock() { return availableStock; }
        public void setAvailableStock(long availableStock) { this.availableStock = availableStock; }
        public long getIssuedItems() { return issuedItems; }
        public void setIssuedItems(long issuedItems) { this.issuedItems = issuedItems; }
        public long getPendingReturns() { return pendingReturns; }
        public void setPendingReturns(long pendingReturns) { this.pendingReturns = pendingReturns; }
        public long getDamagedItems() { return damagedItems; }
        public void setDamagedItems(long damagedItems) { this.damagedItems = damagedItems; }
    }
}
