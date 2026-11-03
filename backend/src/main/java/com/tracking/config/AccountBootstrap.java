package com.tracking.config;

import com.tracking.model.AccountEntity;
import com.tracking.model.WorkspaceEntity;
import com.tracking.repository.AccountRepository;
import com.tracking.repository.WorkspaceRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.Locale;

@Component
public class AccountBootstrap implements ApplicationRunner {
    private final AccountRepository accounts;
    private final WorkspaceRepository workspaces;
    private final PasswordEncoder passwordEncoder;
    private final String username;
    private final String fullName;
    private final String initialPassword;
    private final boolean resetPassword;

    public AccountBootstrap(AccountRepository accounts,
                            WorkspaceRepository workspaces,
                            PasswordEncoder passwordEncoder,
                            @Value("${worksphere.auth.bootstrap.username:vivek.kumar@tubelightcommunications.com}") String username,
                            @Value("${worksphere.auth.bootstrap.full-name:Vivek Kumar}") String fullName,
                            @Value("${worksphere.auth.bootstrap.password:}") String initialPassword,
                            @Value("${worksphere.auth.bootstrap.reset-password:false}") boolean resetPassword) {
        this.accounts = accounts;
        this.workspaces = workspaces;
        this.passwordEncoder = passwordEncoder;
        this.username = username.trim().toLowerCase(Locale.ROOT);
        this.fullName = fullName.trim();
        this.initialPassword = initialPassword;
        this.resetPassword = resetPassword;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (resetPassword) {
            requirePassword();
            AccountEntity account = accounts.findByUsernameIgnoreCase(username)
                    .orElseGet(() -> new AccountEntity(username, fullName, "", "SUPERADMIN", true));
            account.setPasswordHash(passwordEncoder.encode(initialPassword));
            account.setRole("SUPERADMIN");
            account.setEnabled(true);
            addToDefaultWorkspace(accounts.save(account));
            return;
        }

        if (accounts.countByRoleAndEnabledTrue("SUPERADMIN") > 0) return;

        AccountEntity existing = accounts.findByUsernameIgnoreCase(username).orElse(null);
        if (existing != null) {
            existing.setRole("SUPERADMIN");
            existing.setEnabled(true);
            if (initialPassword != null && !initialPassword.isEmpty()) {
                requirePassword();
                existing.setPasswordHash(passwordEncoder.encode(initialPassword));
            }
            addToDefaultWorkspace(accounts.save(existing));
            return;
        }

        requirePassword();
        addToDefaultWorkspace(accounts.save(new AccountEntity(username, fullName,
                passwordEncoder.encode(initialPassword), "SUPERADMIN", true)));
    }

    private void addToDefaultWorkspace(AccountEntity account) {
        WorkspaceEntity workspace = workspaces.findByNameIgnoreCase(WorkspaceBootstrap.DEFAULT_WORKSPACE_NAME)
                .orElseThrow(() -> new IllegalStateException("The default workspace could not be initialized."));
        workspace.addAccount(account);
        workspaces.save(workspace);
    }

    private void requirePassword() {
        if (initialPassword == null || initialPassword.length() < 12) {
            throw new IllegalStateException(
                    "Set WORKSPHERE_SUPERADMIN_PASSWORD to a password of at least 12 characters.");
        }
    }
}
