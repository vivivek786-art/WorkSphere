package com.tracking.model;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.FetchType;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.JoinColumn;
import javax.persistence.JoinTable;
import javax.persistence.ManyToMany;
import javax.persistence.Table;
import java.util.HashSet;
import java.util.Set;

@Entity
@Table(name = "workspaces")
public class WorkspaceEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 80)
    private String name;

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(name = "workspace_accounts",
            joinColumns = @JoinColumn(name = "workspace_id"),
            inverseJoinColumns = @JoinColumn(name = "account_id"))
    private Set<AccountEntity> accounts = new HashSet<>();

    protected WorkspaceEntity() {
    }

    public WorkspaceEntity(String name) {
        this.name = name;
    }

    public Long getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public Set<AccountEntity> getAccounts() {
        return accounts;
    }

    public void addAccount(AccountEntity account) {
        accounts.add(account);
    }

    public void removeAccount(AccountEntity account) {
        accounts.remove(account);
    }

    public void replaceAccounts(Set<AccountEntity> accounts) {
        this.accounts.clear();
        this.accounts.addAll(accounts);
    }
}
