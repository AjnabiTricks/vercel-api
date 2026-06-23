const axios = require("axios");

module.exports = async (req, res) => {

  try {

    res.setHeader("Access-Control-Allow-Origin", "*");

    const cnic = req.query.cnic;

    if (!cnic) {
      return res.status(400).json({ error: "CNIC required" });
    }

    const url = "https://rodb.pulse.gop.pk/registry_index_3/_msearch";

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

    let response;

    try {
      response = await axios.post(url, payload + "\n", {
        timeout: 15000,
        headers: {
          "Content-Type": "application/x-ndjson",
          "Authorization": "Basic cmVhZF9vbmx5X3VzZXJfdjI6cmVhZG9ubHlfMTIz"
        }
      });
    } catch (apiErr) {
      return res.status(500).json({
        error: "Upstream API failed",
        message: apiErr.message
      });
    }

    return res.status(200).json({
      success: true,
      data: response.data
    });

  } catch (err) {
    return res.status(500).json({
      error: "Server crashed",
      message: err.message
    });
  }
};
