package com.tracking.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Bean;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configuration.WebSecurityConfigurerAdapter;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.util.matcher.AntPathRequestMatcher;
import org.springframework.security.web.authentication.LoginUrlAuthenticationEntryPoint;

@Configuration
@EnableWebSecurity
public class SecurityConfig extends WebSecurityConfigurerAdapter {
    private final AccountDetailsService accountDetailsService;

    public SecurityConfig(AccountDetailsService accountDetailsService) {
        this.accountDetailsService = accountDetailsService;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Override
    protected void configure(org.springframework.security.config.annotation.authentication.builders.AuthenticationManagerBuilder auth)
            throws Exception {
        auth.userDetailsService(accountDetailsService).passwordEncoder(passwordEncoder());
    }

    @Override
    protected void configure(HttpSecurity http) throws Exception {
        http
            .csrf()
                .csrfTokenRepository(CookieCsrfTokenRepository.withHttpOnlyFalse())
            .and()
            .logout()
                .logoutUrl("/logout")
                .logoutSuccessUrl("/login.html?logout")
                .invalidateHttpSession(true)
                .deleteCookies("JSESSIONID", "XSRF-TOKEN")
            .and()
            .authorizeRequests()
                .antMatchers(
                    "/login.html",
                    "/login.css",
                    "/login",
                    "/error",
                    "/common/api/v1/auth/me",
                    "/common/api/v1/auth/csrf"
                ).permitAll()
                .antMatchers("/common/api/v1/admin/**").hasAnyRole("ADMIN", "SUPERADMIN")
                .anyRequest().authenticated()
            .and()
            .exceptionHandling()
                .defaultAuthenticationEntryPointFor(
                    (request, response, exception) -> response.sendError(401),
                    new AntPathRequestMatcher("/common/api/**")
                )
                .defaultAuthenticationEntryPointFor(
                    new LoginUrlAuthenticationEntryPoint("/login.html"),
                    new AntPathRequestMatcher("/**")
                )
            .and()
            .formLogin()
                .loginPage("/login.html")
                .loginProcessingUrl("/login")
                .defaultSuccessUrl("/", true)
                .failureUrl("/login.html?error")
                .permitAll();
    }
}
