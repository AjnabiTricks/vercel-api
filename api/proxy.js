const axios = require("axios");

module.exports = async (req, res) => {

  // Enable CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const cnic = req.query.cnic || req.body?.cnic;

    if (!cnic) {
      return res.status(400).json({ 
        success: false,
        error: "CNIC is required" 
      });
    }

    // Remove dashes and validate
    const cleanCNIC = cnic.replace(/[-\s]/g, '');
    if (!/^\d{13}$/.test(cleanCNIC)) {
      return res.status(400).json({
        success: false,
        error: "Invalid CNIC format. Must be 13 digits"
      });
    }

    const url = "https://rodb.pulse.gop.pk/registry_index_3/_search";

    // Search in RegistryParties.CNIC (where the data actually is)
    const requestBody = {
      query: {
        nested: {
          path: "RegistryParties",
          query: {
            term: {
              "RegistryParties.CNIC": cleanCNIC
            }
          }
        }
      },
      size: 50
    };

    const response = await axios.post(url, requestBody, {
      timeout: 30000,
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Basic cmVhZF9vbmx5X3VzZXJfdjI6cmVhZG9ubHlfMTIz",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "*/*",
        "Origin": "https://rod.pulse.gop.pk",
        "Referer": "https://rod.pulse.gop.pk/",
        "x-requested-with": "mark.via.gp"
      }
    });

    const hits = response.data?.hits?.hits || [];
    const total = response.data?.hits?.total?.value || 0;

    return res.status(200).json({
      success: true,
      total: total,
      data: hits,
      credit: "AZ Tricks (https://t.me/AZ_Tricks)"
    });

  } catch (err) {
    console.error("API Error:", err.message);
    
    return res.status(500).json({
      success: false,
      error: "Upstream API failed",
      message: err.message,
      details: err.response?.data || null,
      credit: "AZ Tricks (https://t.me/AZ_Tricks)"
    });
  }
};
