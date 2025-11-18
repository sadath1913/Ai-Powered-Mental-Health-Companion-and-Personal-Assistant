import axios from "axios";

const instance = axios.create({
  baseURL: "http://localhost:8000",
  withCredentials: true, // ✅ allows cookies (JWT) to be sent automatically
});

export default instance;
