package com.tracking.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
public class IssueDateTimeMigration implements ApplicationRunner {
    private static final Logger logger = LoggerFactory.getLogger(IssueDateTimeMigration.class);

    private final JdbcTemplate jdbcTemplate;

    public IssueDateTimeMigration(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public void run(ApplicationArguments args) {
        migrateDateColumn("start_date");
        migrateDateColumn("due_date");
    }

    private void migrateDateColumn(String columnName) {
        String dataType = jdbcTemplate.queryForObject(
                "SELECT DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS "
                        + "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'issues' AND COLUMN_NAME = ?",
                String.class,
                columnName);
        if ("date".equalsIgnoreCase(dataType)) {
            jdbcTemplate.execute("ALTER TABLE issues MODIFY COLUMN " + columnName + " DATETIME NULL");
            logger.info("Migrated issues.{} from DATE to DATETIME.", columnName);
        } else if (!"datetime".equalsIgnoreCase(dataType)) {
            throw new IllegalStateException("Unexpected data type for issues." + columnName + ": " + dataType);
        }
    }
}
