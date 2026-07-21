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

    // Optional filters (default from working curl)
    const tehsilId = req.query.tehsilId || req.body?.tehsilId || "81";
    const fromDate = req.query.fromDate || req.body?.fromDate || "1947-08-14";
    const toDate = req.query.toDate || req.body?.toDate || "2026-07-20";
    const size = req.query.size || req.body?.size || 5;

    const url = "https://rodb.pulse.gop.pk/registry_index_3/_msearch";

    // NDJSON body - exactly like your working curl
    const ndjson = `
{"index":"registry_index_3"}
{"query":{"bool":{"must":[{"term":{"TehsilId":{"value":"${tehsilId}"}}},{"match":{"RegistryParties.CNIC":"${cleanCNIC}"}},{"range":{"RegistryDate":{"gte":"${fromDate}","lte":"${toDate}"}}}]}},"aggs":{"distinct_count":{"cardinality":{"field":"Id"}}},"size":0}
{"index":"registry_index_3"}
{"query":{"bool":{"must":[{"term":{"TehsilId":{"value":"${tehsilId}"}}},{"match":{"RegistryParties.CNIC":"${cleanCNIC}"}},{"range":{"RegistryDate":{"gte":"${fromDate}","lte":"${toDate}"}}}]}},"sort":[{"Id":{"order":"desc"}}],"_source":["Id","RegisteredNumber","MauzaName","RegistryDate"],"from":0,"size":"${size}"}
`;

    const response = await axios.post(url, ndjson, {
      timeout: 30000,
      headers: {
        "Content-Type": "application/x-ndjson",
        "Authorization": "Basic cmVhZF9vbmx5X3VzZXJfdjI6cmVhZG9ubHlfMTIz",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.198 Safari/537.36",
        "Accept": "*/*",
        "Origin": "https://rod.pulse.gop.pk",
        "Referer": "https://rod.pulse.gop.pk/",
        "x-requested-with": "mark.via.gp",
        "sec-ch-ua": '"Not;A=Brand";v="8", "Chromium";v="150", "Android WebView";v="150"',
        "sec-ch-ua-mobile": "?1",
        "sec-ch-ua-platform": '"Android"',
        "sec-fetch-site": "same-site",
        "sec-fetch-mode": "cors",
        "sec-fetch-dest": "empty",
        "accept-encoding": "gzip, deflate, br, zstd",
        "accept-language": "en-US,en;q=0.9"
      }
    });

    // Parse multi-response (2 responses)
    const responses = response.data.split('\n')
      .filter(line => line.trim())
      .map(line => JSON.parse(line));

    const aggResponse = responses[0] || {};
    const dataResponse = responses[1] || {};

    const total = aggResponse?.aggregations?.distinct_count?.value || 0;
    const hits = dataResponse?.hits?.hits || [];

    return res.status(200).json({
      success: true,
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
