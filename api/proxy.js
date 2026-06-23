const axios = require("axios");

module.exports = async (req, res) => {

  res.setHeader("Access-Control-Allow-Origin", "*");

  try {

    const cnic = req.query.cnic;

    if (!cnic) {
      return res.status(400).json({ error: "CNIC required" });
    }

    const url = "https://rodb.pulse.gop.pk/registry_index_3/_msearch";

    // 🚀 NO TEHSIL / DISTRICT FILTER — ONLY CNIC
    const body =
`{"index":"registry_index_3"}
{"query":{"bool":{"must":[
{
  "nested": {
    "path": "RegistryParties",
    "query": {
      "match": {
        "RegistryParties.CNIC": "${cnic}"
      }
    }
  }
}
]}},"size":50}
`;

    const response = await axios.post(url, body + "\n", {
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
