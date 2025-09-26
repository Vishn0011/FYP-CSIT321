import api from "../lib/api";

export const listProperties = () => api.get("/api/properties");
export const getProperty = (id) => api.get(`/api/properties/${id}`);
export const createProperty = (payload) => api.post("/api/properties", payload);
export const updateProperty = (id, payload) =>
  api.patch(`/api/properties/edit/${id}`, payload);
export const deleteProperty = (id) => api.del(`/api/properties/${id}`);
