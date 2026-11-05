package com.tracking.model;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.Id;
import javax.persistence.Lob;
import javax.persistence.Table;

@Entity
@Table(name = "account_profile_photos")
public class AccountProfilePhotoEntity {
    @Id
    @Column(name = "account_id")
    private Long accountId;

    @Lob
    @Column(nullable = false)
    private byte[] imageData;

    @Column(nullable = false, length = 20)
    private String contentType;

    protected AccountProfilePhotoEntity() {
    }

    public AccountProfilePhotoEntity(Long accountId, byte[] imageData, String contentType) {
        this.accountId = accountId;
        this.imageData = imageData;
        this.contentType = contentType;
    }

    public byte[] getImageData() {
        return imageData;
    }

    public String getContentType() {
        return contentType;
    }
}
