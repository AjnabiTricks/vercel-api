const axios = require("axios");

module.exports = async (req, res) => {

  res.setHeader("Access-Control-Allow-Origin", "*");

  const cnic = req.query.cnic;

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

  try {
    const response = await axios.post(url, payload + "\n", {
      headers: {
        "Content-Type": "application/x-ndjson",
        "Authorization": "Basic cmVhZF9vbmx5X3VzZXJfdjI6cmVhZG9ubHlfMTIz"
      }
    });

    res.status(200).json(response.data);

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
