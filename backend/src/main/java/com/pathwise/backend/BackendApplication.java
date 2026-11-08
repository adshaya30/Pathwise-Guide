package com.pathwise.backend;

import io.github.cdimascio.dotenv.Dotenv;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

import java.io.File;

@SpringBootApplication
public class BackendApplication {

	public static void main(String[] args) {
		loadDotenv();
		SpringApplication.run(BackendApplication.class, args);
	}

	private static void loadDotenv() {
		File[] candidateDirs = new File[] { new File(".."), new File("backend"), new File(".") };
		for (File dir : candidateDirs) {
			File envFile = new File(dir, ".env");
			if (envFile.exists() && envFile.isFile()) {
				try {
					Dotenv dotenv = Dotenv.configure()
							.directory(dir.getPath())
							.ignoreIfMissing()
							.load();
					dotenv.entries().forEach(entry -> {
						if (System.getenv(entry.getKey()) == null) {
							System.setProperty(entry.getKey(), entry.getValue());
						}
					});
				} catch (Exception ignored) {
				}
			}
		}
	}

}
