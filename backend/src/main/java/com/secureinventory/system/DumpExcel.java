package com.secureinventory.system;

import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import java.io.FileInputStream;

public class DumpExcel {
    public static void main(String[] args) throws Exception {
        String path = "C:/Users/samba/Downloads/inventory-management-system-main/inventory-management-system-main/COM EQP 25-02-2026.xlsx";
        try (FileInputStream fis = new FileInputStream(path);
             Workbook workbook = new XSSFWorkbook(fis)) {
             
            Sheet sheet = workbook.getSheetAt(1); // ACTIVE SHEET WAS INDEX 1
            for (int i=0; i<10; i++) {
                Row r = sheet.getRow(i);
                if (r == null) continue;
                System.out.print("ROW " + i + ": ");
                for (int j=0; j<r.getLastCellNum(); j++) {
                    Cell c = r.getCell(j);
                    if (c == null) System.out.print("[] ");
                    else System.out.print("[" + c.toString() + "] ");
                }
                System.out.println();
            }
        }
    }
}
