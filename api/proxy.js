const axios = require("axios");

module.exports = async (req, res) => {

  res.setHeader("Access-Control-Allow-Origin", "*");

  try {

    const cnic = req.query.cnic;

    if (!cnic) {
      return res.status(400).json({ error: "CNIC required" });
    }

    const url = "https://rodb.pulse.gop.pk/registry_index_3/_msearch";

    // ⚠️ MUST BE EXACT NDJSON FORMAT (2 BLOCKS ONLY)
    const payload =
`{"index":"registry_index_3"}
{"query":{"bool":{"must":[
{"term":{"TehsilId":{"value":"123"}}},
{"nested":{
  "path":"RegistryParties",
  "query":{"bool":{"must":[
    {"match":{"RegistryParties.CNIC":"${cnic}"}}
  ]}}
}}
]}},"size":5}
`;

    const response = await axios.post(url, payload + "\n", {
      timeout: 20000,
      headers: {
        "Content-Type": "application/x-ndjson",
        "Authorization": "Basic cmVhZF9vbmx5X3VzZXJfdjI6cmVhZG9ubHlfMTIz"
      }
    });

    return res.status(200).json({
      success: true,
      result: response.data
    });

  } catch (err) {

    return res.status(500).json({
      error: "Upstream API failed",
      message: err.message,
      details: err.response?.data || null
    });
  }
};
