# ===== 阶段 1：构建前端 =====
FROM node:22-alpine AS frontend-build
WORKDIR /workspace/frontend
COPY frontend/web/package.json frontend/web/package-lock.json ./
RUN npm ci
COPY frontend/web/ ./
RUN npm run build

# ===== 阶段 2：构建后端（前端产物并入静态资源） =====
FROM maven:3.9-eclipse-temurin-17 AS backend-build
WORKDIR /workspace
COPY backend/pom.xml ./backend/pom.xml
COPY backend/src ./backend/src
COPY --from=frontend-build /workspace/frontend/dist/ ./backend/src/main/resources/static/
RUN mvn -B -ntp -f backend/pom.xml clean package -DskipTests

# ===== 阶段 3：运行 =====
FROM eclipse-temurin:17-jre
WORKDIR /app
COPY --from=backend-build /workspace/backend/target/aibase-backend-*.jar /app/aibase.jar
ENV AIBASE_DATA_DIR=/app/data
EXPOSE 18081
VOLUME ["/app/data"]
ENTRYPOINT ["java", "-jar", "/app/aibase.jar"]
