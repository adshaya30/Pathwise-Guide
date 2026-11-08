package com.pathwise.backend.config;

import io.github.cdimascio.dotenv.Dotenv;
import io.github.cdimascio.dotenv.DotenvEntry;
import org.springframework.boot.SpringApplication;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.MapPropertySource;
import org.springframework.core.env.StandardEnvironment;

import java.io.File;
import java.util.HashMap;
import java.util.Map;

@Order(Ordered.HIGHEST_PRECEDENCE)
@SuppressWarnings("deprecation")
public class DotenvEnvironmentPostProcessor implements
        org.springframework.boot.EnvironmentPostProcessor,
        org.springframework.boot.env.EnvironmentPostProcessor {

    @Override
    public void postProcessEnvironment(ConfigurableEnvironment environment, SpringApplication application) {
        Map<String, Object> envProperties = new HashMap<>();

        // Inspect candidate locations from broadest to most specific
        File[] candidateDirs = new File[] { new File(".."), new File("backend"), new File(".") };
        for (File dir : candidateDirs) {
            File envFile = new File(dir, ".env");
            if (envFile.exists() && envFile.isFile()) {
                try {
                    Dotenv dotenv = Dotenv.configure()
                            .directory(dir.getPath())
                            .ignoreIfMissing()
                            .load();
                    for (DotenvEntry entry : dotenv.entries()) {
                        String key = entry.getKey();
                        String value = entry.getValue();
                        envProperties.put(key, value);
                        if (System.getenv(key) == null) {
                            System.setProperty(key, value);
                        }
                    }
                } catch (Exception ignored) {
                }
            }
        }

        if (!envProperties.isEmpty()) {
            if (environment.getPropertySources().contains(StandardEnvironment.SYSTEM_ENVIRONMENT_PROPERTY_SOURCE_NAME)) {
                environment.getPropertySources().addAfter(
                        StandardEnvironment.SYSTEM_ENVIRONMENT_PROPERTY_SOURCE_NAME,
                        new MapPropertySource("dotenvProperties", envProperties)
                );
            } else {
                environment.getPropertySources().addFirst(new MapPropertySource("dotenvProperties", envProperties));
            }
        }
    }
}
