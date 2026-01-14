import fetch from "node-fetch";

const BASE_URL = "http://localhost:3000";

async function testAuth() {
  const email = `testuser_${Date.now()}@example.com`;
  const password = "password123";

  console.log(`Testing with email: ${email}`);

  // 1. Sign Up
  console.log("--- Testing Sign Up ---");
  try {
    const registerResponse = await fetch(`${BASE_URL}/users/register`, {
      method: "POST",
      body: JSON.stringify({ email, password }),
      headers: { "Content-Type": "application/json" },
    });
    const registerData = await registerResponse.json();

    if (registerResponse.ok) {
      console.log("✅ Sign Up Successful");
      console.log("User:", registerData.user);
      console.log("Token:", registerData.token ? "Present" : "Missing");
    } else {
      console.error("❌ Sign Up Failed:", registerData);
      process.exit(1);
    }
  } catch (error) {
    console.error("❌ Sign Up Error:", error.message);
    process.exit(1);
  }

  // 2. Login
  console.log("\n--- Testing Login ---");
  try {
    const loginResponse = await fetch(`${BASE_URL}/users/login`, {
      method: "POST",
      body: JSON.stringify({ email, password }),
      headers: { "Content-Type": "application/json" },
    });
    const loginData = await loginResponse.json();

    if (loginResponse.ok) {
      console.log("✅ Login Successful");
      console.log("User:", loginData.user);
      console.log("Token:", loginData.token ? "Present" : "Missing");
    } else {
      console.error("❌ Login Failed:", loginData);
      process.exit(1);
    }
  } catch (error) {
    console.error("❌ Login Error:", error.message);
    process.exit(1);
  }
}

testAuth();
