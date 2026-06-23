const axios = require("axios");

module.exports = async (req, res) => {

  res.setHeader("Access-Control-Allow-Origin", "*");

  try {

    const cnic = req.query.cnic;

    if (!cnic) {
      return res.status(400).json({ error: "CNIC required" });
    }

    const url = "https://rodb.pulse.gop.pk/registry_index_3/_msearch";

    // ✅ SAFE NDJSON BUILD (NO STRING BREAK ISSUE)
    const query = {
      index: "registry_index_3"
    };

    const bodyQuery = {
      query: {
        bool: {
          must: [
            {
              nested: {
                path: "RegistryParties",
                query: {
                  match: {
                    "RegistryParties.CNIC": cnic
                  }
                }
              }
            }
          ]
        }
      },
      size: 50
    };

    const body =
      JSON.stringify(query) +
      "\n" +
      JSON.stringify(bodyQuery) +
      "\n";

    const response = await axios.post(url, body, {
      timeout: 20000,
      headers: {
        "Content-Type": "application/x-ndjson",
        "Authorization": "Basic cmVhZF9vbmx5X3VzZXJfdjI6cmVhZG9ubHlfMTIz"
      }
    });

    return res.status(200).json({
      success: true,
      data: response.data
    });

  } catch (err) {

    return res.status(500).json({
      error: "Upstream API failed",
      message: err.message,
      details: err.response?.data || null
    });
  }
};
