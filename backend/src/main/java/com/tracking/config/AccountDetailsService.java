package com.tracking.config;

import com.tracking.model.AccountEntity;
import com.tracking.repository.AccountRepository;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

@Service
public class AccountDetailsService implements UserDetailsService {
    private final AccountRepository accounts;

    public AccountDetailsService(AccountRepository accounts) {
        this.accounts = accounts;
    }

    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        AccountEntity account = accounts.findByUsernameIgnoreCase(username)
                .orElseThrow(() -> new UsernameNotFoundException("Account not found."));
        return User.withUsername(account.getUsername())
                .password(account.getPasswordHash())
                .authorities("ROLE_" + account.getRole())
                .disabled(!account.isEnabled())
                .build();
    }
}
