package com.pathwise.backend.dto;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BulkDeleteResponse {
    private int totalDeleted;
    private String message;
}
