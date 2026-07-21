const axios = require("axios");

module.exports = async (req, res) => {

  // Enable CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Handle preflight OPTIONS request
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    // Extract CNIC from query or body
    const cnic = req.query.cnic || req.body?.cnic;

    if (!cnic) {
      return res.status(400).json({ 
        success: false,
        error: "CNIC is required" 
      });
    }

    // Clean and validate CNIC (remove dashes if any)
    const cleanCNIC = cnic.replace(/-/g, '');
    if (!/^\d{13}$/.test(cleanCNIC)) {
      return res.status(400).json({
        success: false,
        error: "Invalid CNIC format. Must be 13 digits"
      });
    }

    const url = "https://rodb.pulse.gop.pk/registry_index_3/_search";

    // Updated query format for Elasticsearch
    const requestBody = {
      query: {
        nested: {
          path: "RegistryParties",
          query: {
            match: {
              "RegistryParties.CNIC": cleanCNIC
            }
          }
        }
      },
      size: 50,
      _source: true
    };

    const response = await axios.post(url, requestBody, {
      timeout: 30000,
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Basic cmVhZF9vbmx5X3VzZXJfdjI6cmVhZG9ubHlfMTIz",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      }
    });

    // Extract hits from response
    const hits = response.data?.hits?.hits || [];
    const total = response.data?.hits?.total?.value || 0;

    return res.status(200).json({
      success: true,
      total: total,
      data: hits,
      raw: response.data
    });

  } catch (err) {
    console.error("API Error:", err.message);
    
    let errorMessage = "Upstream API failed";
    let details = null;

    if (err.response) {
      // The request was made and the server responded with a status code
      details = {
        status: err.response.status,
        data: err.response.data
      };
      errorMessage = `API returned ${err.response.status}`;
    } else if (err.request) {
      // The request was made but no response was received
      details = {
        message: "No response received from upstream API"
      };
      errorMessage = "Upstream API timeout or unreachable";
    }

    return res.status(500).json({
      success: false,
      error: errorMessage,
      details: details,
      message: err.message
    });
  }
};
