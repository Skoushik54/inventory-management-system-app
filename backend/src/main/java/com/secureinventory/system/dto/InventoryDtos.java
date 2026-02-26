package com.secureinventory.system.dto;

import java.time.LocalDateTime;

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
        private String barcode;
        private String badgeNumber;
        private String name;
        private String department;
        private String phone;
        private String others;
        private int quantity;
        private String purpose;

        public String getBarcode() { return barcode; }
        public void setBarcode(String barcode) { this.barcode = barcode; }
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
        public int getQuantity() { return quantity; }
        public void setQuantity(int quantity) { this.quantity = quantity; }
        public String getPurpose() { return purpose; }
        public void setPurpose(String purpose) { this.purpose = purpose; }
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
}
