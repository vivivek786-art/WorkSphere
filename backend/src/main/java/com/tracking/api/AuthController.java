package com.tracking.api;

import com.tracking.model.AccountEntity;
import com.tracking.model.AccountProfilePhotoEntity;
import com.tracking.repository.AccountRepository;
import com.tracking.repository.AccountProfilePhotoRepository;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.stream.ImageInputStream;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/common/api/v1/auth")
public class AuthController {
    private static final int MAX_PHOTO_BYTES = 2 * 1024 * 1024;
    private static final int MAX_PHOTO_DIMENSION = 2048;
    private final AccountRepository accounts;
    private final AccountProfilePhotoRepository profilePhotos;

    public AuthController(AccountRepository accounts, AccountProfilePhotoRepository profilePhotos) {
        this.accounts = accounts;
        this.profilePhotos = profilePhotos;
    }

    @GetMapping("/me")
    public Map<String, String> getCurrentUser(Authentication authentication) {
        Map<String, String> profile = new LinkedHashMap<>();
        if (authentication == null || !authentication.isAuthenticated()
                || "anonymousUser".equals(authentication.getPrincipal())) {
            profile.put("name", "Local developer");
            profile.put("email", "");
            profile.put("picture", "");
            profile.put("authenticated", "false");
            return profile;
        }
        AccountEntity account = accounts.findByUsernameIgnoreCase(authentication.getName())
                .orElseThrow(() -> new IllegalStateException("Authenticated account could not be found."));
        profile.put("name", account.getFullName());
        profile.put("email", account.getUsername());
        profile.put("picture", profilePhotos.existsById(account.getId())
                ? "/common/api/v1/auth/me/photo" : "");
        profile.put("authenticated", "true");
        profile.put("role", account.getRole());
        return profile;
    }

    @GetMapping("/me/photo")
    public ResponseEntity<byte[]> getProfilePhoto(Authentication authentication) {
        AccountEntity account = requirePhotoAccount(authentication);
        AccountProfilePhotoEntity photo = profilePhotos.findById(account.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No profile photo is set."));
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType(photo.getContentType()));
        headers.setCacheControl(CacheControl.noStore().cachePrivate());
        headers.set("X-Content-Type-Options", "nosniff");
        return new ResponseEntity<>(photo.getImageData(), headers, HttpStatus.OK);
    }

    @PostMapping(value = "/me/photo", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Transactional
    public ResponseEntity<Void> uploadProfilePhoto(Authentication authentication,
                                                   @RequestParam("photo") MultipartFile photo) throws IOException {
        AccountEntity account = requirePhotoAccount(authentication);
        if (photo.isEmpty() || photo.getSize() > MAX_PHOTO_BYTES) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose an image up to 2 MB.");
        }
        byte[] image = photo.getBytes();
        String contentType = validatePhoto(image);
        profilePhotos.save(new AccountProfilePhotoEntity(account.getId(), image, contentType));
        return ResponseEntity.noContent().build();
    }

    private AccountEntity requirePhotoAccount(Authentication authentication) {
        AccountEntity account = accounts.findByUsernameIgnoreCase(authentication.getName())
                .orElseThrow(() -> new IllegalStateException("Authenticated account could not be found."));
        if (!"ADMIN".equals(account.getRole()) && !"SUPERADMIN".equals(account.getRole())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Only admins and superadmins can manage a profile photo.");
        }
        return account;
    }

    private String validatePhoto(byte[] image) {
        String contentType;
        if (image.length >= 8 && (image[0] & 0xff) == 0x89 && image[1] == 0x50
                && image[2] == 0x4e && image[3] == 0x47 && image[4] == 0x0d
                && image[5] == 0x0a && image[6] == 0x1a && image[7] == 0x0a) {
            contentType = "image/png";
        } else if (image.length >= 3 && (image[0] & 0xff) == 0xff
                && (image[1] & 0xff) == 0xd8 && (image[2] & 0xff) == 0xff) {
            contentType = "image/jpeg";
        } else {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only PNG and JPEG images are supported.");
        }

        try (ImageInputStream input = ImageIO.createImageInputStream(new ByteArrayInputStream(image))) {
            if (input == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "The selected file is not a valid image.");
            }
            Iterator<ImageReader> readers = ImageIO.getImageReaders(input);
            if (!readers.hasNext()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "The selected file is not a valid image.");
            }
            ImageReader reader = readers.next();
            try {
                reader.setInput(input, true, true);
                String format = reader.getFormatName();
                if (!("image/png".equals(contentType) && "png".equalsIgnoreCase(format))
                        && !("image/jpeg".equals(contentType) && "jpeg".equalsIgnoreCase(format))) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "The selected file is not a valid image.");
                }
                int width = reader.getWidth(0);
                int height = reader.getHeight(0);
                if (width < 1 || height < 1 || width > MAX_PHOTO_DIMENSION || height > MAX_PHOTO_DIMENSION) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                            "Images must be no larger than 2048 by 2048 pixels.");
                }
                if (reader.read(0) == null) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "The selected file is not a valid image.");
                }
            } finally {
                reader.dispose();
            }
        } catch (IOException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "The selected file is not a valid image.",
                    exception);
        }
        return contentType;
    }

    @GetMapping("/csrf")
    public Map<String, String> getCsrfToken(@RequestAttribute("_csrf") CsrfToken csrfToken) {
        Map<String, String> token = new LinkedHashMap<>();
        token.put("token", csrfToken.getToken());
        token.put("parameterName", csrfToken.getParameterName());
        return token;
    }

}
