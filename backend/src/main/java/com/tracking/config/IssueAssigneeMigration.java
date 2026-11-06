package com.tracking.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
public class IssueAssigneeMigration implements ApplicationRunner {
    private static final Logger logger = LoggerFactory.getLogger(IssueAssigneeMigration.class);

    private final JdbcTemplate jdbcTemplate;

    public IssueAssigneeMigration(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public void run(ApplicationArguments args) {
        int migrated = jdbcTemplate.update(
                "INSERT INTO issue_assignees (issue_id, member_id) "
                        + "SELECT i.id, i.assignee_id FROM issues i "
                        + "LEFT JOIN issue_assignees assignment ON assignment.issue_id = i.id "
                        + "AND assignment.member_id = i.assignee_id "
                        + "WHERE i.assignee_id IS NOT NULL AND assignment.issue_id IS NULL");
        if (migrated > 0) {
            logger.info("Migrated {} existing issue assignee(s).", migrated);
        }
    }
}
