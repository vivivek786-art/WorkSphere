package com.tracking.api;

import com.tracking.model.AccountEntity;
import com.tracking.repository.AccountRepository;
import org.springframework.security.core.Authentication;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/common/api/v1/auth")
public class AuthController {
    private final AccountRepository accounts;

    public AuthController(AccountRepository accounts) {
        this.accounts = accounts;
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
        profile.put("picture", "");
        profile.put("authenticated", "true");
        profile.put("role", account.getRole());
        return profile;
    }

    @GetMapping("/csrf")
    public Map<String, String> getCsrfToken(@RequestAttribute("_csrf") CsrfToken csrfToken) {
        Map<String, String> token = new LinkedHashMap<>();
        token.put("token", csrfToken.getToken());
        token.put("parameterName", csrfToken.getParameterName());
        return token;
    }

}
