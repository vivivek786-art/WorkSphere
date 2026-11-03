package com.tracking.api;

import com.tracking.config.WorkspaceAccessService;
import com.tracking.model.AccountEntity;
import com.tracking.model.WorkspaceEntity;
import com.tracking.repository.AccountRepository;
import com.tracking.repository.WorkspaceRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import javax.validation.Valid;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Locale;
import java.util.stream.Collectors;

@Validated
@RestController
@RequestMapping("/common/api/v1/admin/accounts")
public class AccountController {
    private static final List<String> ROLES = java.util.Arrays.asList("USER", "ADMIN", "SUPERADMIN");

    private final AccountRepository accounts;
    private final WorkspaceRepository workspaces;
    private final PasswordEncoder passwordEncoder;
    private final WorkspaceAccessService workspaceAccess;

    public AccountController(AccountRepository accounts, WorkspaceRepository workspaces,
                             PasswordEncoder passwordEncoder, WorkspaceAccessService workspaceAccess) {
        this.accounts = accounts;
        this.workspaces = workspaces;
        this.passwordEncoder = passwordEncoder;
        this.workspaceAccess = workspaceAccess;
    }

    @GetMapping
    public List<ApiModels.AccountResponse> getAccounts() {
        return accounts.findAllByOrderByFullNameAsc().stream()
                .map(ApiModels.AccountResponse::new)
                .collect(Collectors.toList());
    }

    @PostMapping
    @Transactional
    public ApiModels.AccountResponse createAccount(@Valid @RequestBody ApiModels.AccountRequest request,
                                                   Authentication authentication,
                                                   @RequestHeader(value = "X-Workspace-Id", required = false) Long workspaceId) {
        WorkspaceEntity workspace = workspaceAccess.requireWorkspace(workspaceId, authentication);
        String role = validateRole(request.role, authentication);
        String username = normalizeUsername(request.username);
        if (accounts.existsByUsernameIgnoreCase(username)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "That username already exists.");
        }
        validatePassword(request.password, true);
        AccountEntity account = new AccountEntity(username, request.fullName.trim(),
                passwordEncoder.encode(request.password), role, request.enabled);
        account = accounts.save(account);
        workspace.addAccount(account);
        workspaces.save(workspace);
        return new ApiModels.AccountResponse(account);
    }

    @PutMapping("/{id}")
    @Transactional
    public ApiModels.AccountResponse updateAccount(@PathVariable Long id,
                                                   @Valid @RequestBody ApiModels.AccountRequest request,
                                                   Authentication authentication) {
        AccountEntity account = requireAccount(id);
        String role = validateRole(request.role, authentication);
        String username = normalizeUsername(request.username);
        validateSelfUpdate(account, username, role, request.enabled, authentication);
        accounts.findByUsernameIgnoreCase(username).ifPresent(existing -> {
            if (!existing.getId().equals(id)) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "That username already exists.");
            }
        });
        preventRemovingLastSuperadmin(account, role, request.enabled);
        account.update(username, request.fullName.trim(), role, request.enabled);
        if (request.password != null && !request.password.isEmpty()) {
            validatePassword(request.password, false);
            account.setPasswordHash(passwordEncoder.encode(request.password));
        }
        return new ApiModels.AccountResponse(accounts.save(account));
    }

    @DeleteMapping("/{id}")
    @Transactional
    public ResponseEntity<Void> deleteAccount(@PathVariable Long id, Authentication authentication) {
        AccountEntity account = requireAccount(id);
        requireNotSelf(account, authentication);
        requireManagedRole(account, authentication);
        preventRemovingLastSuperadmin(account, "USER", false);
        for (WorkspaceEntity workspace : workspaces.findAll()) {
            if (workspace.getAccounts().remove(account)) {
                workspaces.save(workspace);
            }
        }
        accounts.delete(account);
        return ResponseEntity.noContent().build();
    }

    private AccountEntity requireAccount(Long id) {
        return accounts.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Account not found."));
    }

    private String validateRole(String requestedRole, Authentication authentication) {
        String role = requestedRole == null ? "" : requestedRole.trim().toUpperCase(Locale.ROOT);
        if (!ROLES.contains(role)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported account role.");
        }
        if (!isSuperadmin(authentication) && !"USER".equals(role)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only a superadmin can assign administrator roles.");
        }
        return role;
    }

    private void validatePassword(String password, boolean required) {
        if ((password == null || password.isEmpty()) && !required) return;
        if (password == null || password.length() < 12
                || password.getBytes(StandardCharsets.UTF_8).length > 72) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Passwords must be at least 12 characters and no more than 72 UTF-8 bytes.");
        }
    }

    private void preventRemovingLastSuperadmin(AccountEntity account, String newRole, boolean enabled) {
        if ("SUPERADMIN".equals(account.getRole()) && account.isEnabled()
                && (!"SUPERADMIN".equals(newRole) || !enabled)
                && accounts.countByRoleAndEnabledTrue("SUPERADMIN") <= 1) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "At least one enabled superadmin account must remain.");
        }
    }

    private void requireNotSelf(AccountEntity account, Authentication authentication) {
        if (account.getUsername().equalsIgnoreCase(authentication.getName())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "You cannot edit or delete the account you are currently using.");
        }
    }

    private void validateSelfUpdate(AccountEntity account, String username, String role, boolean enabled,
                                    Authentication authentication) {
        if (account.getUsername().equalsIgnoreCase(authentication.getName())
                && (!account.getUsername().equalsIgnoreCase(username)
                || !account.getRole().equals(role) || !enabled)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "You may update your name or password, but cannot change your own username, role, or access.");
        }
    }

    private void requireManagedRole(AccountEntity account, Authentication authentication) {
        if (!isSuperadmin(authentication) && !"USER".equals(account.getRole())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Admins can only remove user accounts.");
        }
    }

    private boolean isSuperadmin(Authentication authentication) {
        return authentication.getAuthorities().stream()
                .anyMatch(authority -> "ROLE_SUPERADMIN".equals(authority.getAuthority()));
    }

    private String normalizeUsername(String username) {
        return username.trim().toLowerCase(Locale.ROOT);
    }
}
