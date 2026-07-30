const axios = require("axios");

// ===== SIMPLE IN-MEMORY CACHE (No external dependency) =====
const cache = new Map();
const CACHE_TTL = 3600000; // 1 hour in milliseconds

// Clean expired cache entries
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of cache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      cache.delete(key);
    }
  }
}, 60000); // Check every minute

// ===== RETRY FUNCTION =====
async function fetchWithRetry(url, body, headers, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await axios.post(url, body, {
        timeout: 9000,
        headers,
      });
    } catch (err) {
      if (i === maxRetries - 1) throw err;
      console.log(`Retry ${i + 1}/${maxRetries}`);
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
}

module.exports = async (req, res) => {
  // CORS
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

    const cleanCNIC = cnic.replace(/[-\s]/g, '');
    if (!/^\d{13}$/.test(cleanCNIC)) {
      return res.status(400).json({
        success: false,
        error: "Invalid CNIC format. Must be 13 digits"
      });
    }

    // ===== CHECK CACHE =====
    const cacheKey = `cnic_${cleanCNIC}`;
    const cached = cache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
      console.log(`📦 Cache hit for CNIC: ${cleanCNIC}`);
      return res.status(200).json({
        success: true,
        cached: true,
        total: cached.total,
        data: cached.data,
        credit: "AZ Tricks (https://t.me/AZ_Tricks)"
      });
    }

    console.log(`🔍 Cache miss for CNIC: ${cleanCNIC}`);

    const url = "https://rodb.pulse.gop.pk/registry_index_3/_search";

    const requestBody = {
      query: {
        bool: {
          should: [
            { match: { "RegistryParties.CNIC": cleanCNIC } },
            { term: { "Id": parseInt(cleanCNIC, 10) } }
          ],
          minimum_should_match: 1
        }
      },
      size: 100
    };

    const response = await fetchWithRetry(url, requestBody, {
      "Content-Type": "application/json",
      "Authorization": "Basic cmVhZF9vbmx5X3VzZXJfdjI6cmVhZG9ubHlfMTIz",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Accept": "*/*",
      "Origin": "https://rod.pulse.gop.pk",
      "Referer": "https://rod.pulse.gop.pk/",
      "x-requested-with": "mark.via.gp"
    });

    const hits = response.data?.hits?.hits || [];
    const total = response.data?.hits?.total?.value || 0;

    // ===== CACHE ONLY IF DATA EXISTS =====
    if (total > 0 && hits.length > 0) {
      cache.set(cacheKey, {
        total: total,
        data: hits,
        timestamp: Date.now()
      });
      console.log(`💾 Cached CNIC: ${cleanCNIC} (${total} records)`);
    } else {
      console.log(`⚠️ No data found for CNIC: ${cleanCNIC}`);
    }

    return res.status(200).json({
      success: true,
      cached: false,
      total: total,
      data: hits,
      credit: "AZ Tricks (https://t.me/AZ_Tricks)"
    });

  } catch (err) {
    console.error("API Error:", err.message);

    let errorMessage = "Upstream API failed";
    let details = null;

    if (err.response) {
      details = {
        status: err.response.status,
        data: err.response.data
      };
      errorMessage = `API returned ${err.response.status}`;
    } else if (err.request) {
      details = {
        message: "No response received from upstream API"
      };
      errorMessage = "Upstream API timeout or unreachable";
    }

    return res.status(500).json({
      success: false,
      error: errorMessage,
      details: details,
      message: err.message,
      credit: "AZ Tricks (https://t.me/AZ_Tricks)"
    });
  }
};
