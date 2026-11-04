"use strict";
exports.ErrorEnvelope = validate21;
const schema32 = {
  type: "object",
  additionalProperties: false,
  properties: {
    error: { $ref: "#/components/schemas/ErrorDetail" },
    meta: { $ref: "#/components/schemas/Meta" },
  },
  required: ["error", "meta"],
};
const schema35 = {
  type: "object",
  additionalProperties: false,
  properties: {
    requestId: {
      type: "string",
      description: "معرّف تتبع الطلب.",
      format: "uuid",
    },
    serverTime: {
      type: "string",
      description: "وقت الاستجابة UTC.",
      format: "date-time",
    },
    apiVersion: { type: "string", description: "إصدار الواجهة.", example: "1" },
  },
  required: ["requestId", "serverTime", "apiVersion"],
};
const schema33 = {
  type: "object",
  additionalProperties: false,
  properties: {
    code: {
      type: "string",
      description: "رمز خطأ تطبيقي ثابت للمستهلك.",
      enum: [
        "invalid_input",
        "unauthenticated",
        "forbidden",
        "not_found",
        "session_expired",
        "revision_conflict",
        "idempotency_conflict",
        "request_in_progress",
        "invalid_state",
        "content_version_conflict",
        "math_unsupported",
        "math_inconclusive",
        "math_unavailable",
        "ai_unavailable",
        "rate_limited",
        "internal_error",
        "csrf_invalid",
      ],
    },
    messageAr: { type: "string" },
    issues: {
      type: "array",
      items: { $ref: "#/components/schemas/ValidationIssue" },
    },
    currentRevision: {
      anyOf: [
        {
          type: "integer",
          format: "int32",
          description: "آخر إصدار عند تعارض تعديل.",
          minimum: 0,
          maximum: 2147483647,
          example: 4,
        },
        { type: "null" },
      ],
    },
    retryable: { type: "boolean" },
    retryAfterSeconds: {
      anyOf: [
        { type: "integer", format: "int32", minimum: 0 },
        { type: "null" },
      ],
    },
  },
  required: [
    "code",
    "messageAr",
    "issues",
    "currentRevision",
    "retryable",
    "retryAfterSeconds",
  ],
};
const schema34 = {
  type: "object",
  additionalProperties: false,
  properties: {
    path: { type: "string", example: "body.expectedRevision" },
    rule: { type: "string", example: "required" },
    messageAr: { type: "string" },
  },
  required: ["path", "rule", "messageAr"],
};
const formats0 = require("ajv-formats/dist/formats").fullFormats.int32;
function validate22(
  data,
  {
    instancePath = "",
    parentData,
    parentDataProperty,
    rootData = data,
    dynamicAnchors = {},
  } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate22.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (errors === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (
        (data.code === undefined && (missing0 = "code")) ||
        (data.messageAr === undefined && (missing0 = "messageAr")) ||
        (data.issues === undefined && (missing0 = "issues")) ||
        (data.currentRevision === undefined &&
          (missing0 = "currentRevision")) ||
        (data.retryable === undefined && (missing0 = "retryable")) ||
        (data.retryAfterSeconds === undefined &&
          (missing0 = "retryAfterSeconds"))
      ) {
        validate22.errors = [
          {
            instancePath,
            schemaPath: "#/required",
            keyword: "required",
            params: { missingProperty: missing0 },
            message: "must have required property '" + missing0 + "'",
          },
        ];
        return false;
      } else {
        const _errs1 = errors;
        for (const key0 in data) {
          if (
            !(
              key0 === "code" ||
              key0 === "messageAr" ||
              key0 === "issues" ||
              key0 === "currentRevision" ||
              key0 === "retryable" ||
              key0 === "retryAfterSeconds"
            )
          ) {
            validate22.errors = [
              {
                instancePath,
                schemaPath: "#/additionalProperties",
                keyword: "additionalProperties",
                params: { additionalProperty: key0 },
                message: "must NOT have additional properties",
              },
            ];
            return false;
            break;
          }
        }
        if (_errs1 === errors) {
          if (data.code !== undefined) {
            let data0 = data.code;
            const _errs2 = errors;
            if (typeof data0 !== "string") {
              validate22.errors = [
                {
                  instancePath: instancePath + "/code",
                  schemaPath: "#/properties/code/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                },
              ];
              return false;
            }
            if (
              !(
                data0 === "invalid_input" ||
                data0 === "unauthenticated" ||
                data0 === "forbidden" ||
                data0 === "not_found" ||
                data0 === "session_expired" ||
                data0 === "revision_conflict" ||
                data0 === "idempotency_conflict" ||
                data0 === "request_in_progress" ||
                data0 === "invalid_state" ||
                data0 === "content_version_conflict" ||
                data0 === "math_unsupported" ||
                data0 === "math_inconclusive" ||
                data0 === "math_unavailable" ||
                data0 === "ai_unavailable" ||
                data0 === "rate_limited" ||
                data0 === "internal_error" ||
                data0 === "csrf_invalid"
              )
            ) {
              validate22.errors = [
                {
                  instancePath: instancePath + "/code",
                  schemaPath: "#/properties/code/enum",
                  keyword: "enum",
                  params: { allowedValues: schema33.properties.code.enum },
                  message: "must be equal to one of the allowed values",
                },
              ];
              return false;
            }
            var valid0 = _errs2 === errors;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.messageAr !== undefined) {
              const _errs4 = errors;
              if (typeof data.messageAr !== "string") {
                validate22.errors = [
                  {
                    instancePath: instancePath + "/messageAr",
                    schemaPath: "#/properties/messageAr/type",
                    keyword: "type",
                    params: { type: "string" },
                    message: "must be string",
                  },
                ];
                return false;
              }
              var valid0 = _errs4 === errors;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.issues !== undefined) {
                let data2 = data.issues;
                const _errs6 = errors;
                if (errors === _errs6) {
                  if (Array.isArray(data2)) {
                    var valid1 = true;
                    const len0 = data2.length;
                    for (let i0 = 0; i0 < len0; i0++) {
                      let data3 = data2[i0];
                      const _errs8 = errors;
                      const _errs9 = errors;
                      if (errors === _errs9) {
                        if (
                          data3 &&
                          typeof data3 == "object" &&
                          !Array.isArray(data3)
                        ) {
                          let missing1;
                          if (
                            (data3.path === undefined && (missing1 = "path")) ||
                            (data3.rule === undefined && (missing1 = "rule")) ||
                            (data3.messageAr === undefined &&
                              (missing1 = "messageAr"))
                          ) {
                            validate22.errors = [
                              {
                                instancePath: instancePath + "/issues/" + i0,
                                schemaPath:
                                  "#/components/schemas/ValidationIssue/required",
                                keyword: "required",
                                params: { missingProperty: missing1 },
                                message:
                                  "must have required property '" +
                                  missing1 +
                                  "'",
                              },
                            ];
                            return false;
                          } else {
                            const _errs11 = errors;
                            for (const key1 in data3) {
                              if (
                                !(
                                  key1 === "path" ||
                                  key1 === "rule" ||
                                  key1 === "messageAr"
                                )
                              ) {
                                validate22.errors = [
                                  {
                                    instancePath:
                                      instancePath + "/issues/" + i0,
                                    schemaPath:
                                      "#/components/schemas/ValidationIssue/additionalProperties",
                                    keyword: "additionalProperties",
                                    params: { additionalProperty: key1 },
                                    message:
                                      "must NOT have additional properties",
                                  },
                                ];
                                return false;
                                break;
                              }
                            }
                            if (_errs11 === errors) {
                              if (data3.path !== undefined) {
                                const _errs12 = errors;
                                if (typeof data3.path !== "string") {
                                  validate22.errors = [
                                    {
                                      instancePath:
                                        instancePath +
                                        "/issues/" +
                                        i0 +
                                        "/path",
                                      schemaPath:
                                        "#/components/schemas/ValidationIssue/properties/path/type",
                                      keyword: "type",
                                      params: { type: "string" },
                                      message: "must be string",
                                    },
                                  ];
                                  return false;
                                }
                                var valid3 = _errs12 === errors;
                              } else {
                                var valid3 = true;
                              }
                              if (valid3) {
                                if (data3.rule !== undefined) {
                                  const _errs14 = errors;
                                  if (typeof data3.rule !== "string") {
                                    validate22.errors = [
                                      {
                                        instancePath:
                                          instancePath +
                                          "/issues/" +
                                          i0 +
                                          "/rule",
                                        schemaPath:
                                          "#/components/schemas/ValidationIssue/properties/rule/type",
                                        keyword: "type",
                                        params: { type: "string" },
                                        message: "must be string",
                                      },
                                    ];
                                    return false;
                                  }
                                  var valid3 = _errs14 === errors;
                                } else {
                                  var valid3 = true;
                                }
                                if (valid3) {
                                  if (data3.messageAr !== undefined) {
                                    const _errs16 = errors;
                                    if (typeof data3.messageAr !== "string") {
                                      validate22.errors = [
                                        {
                                          instancePath:
                                            instancePath +
                                            "/issues/" +
                                            i0 +
                                            "/messageAr",
                                          schemaPath:
                                            "#/components/schemas/ValidationIssue/properties/messageAr/type",
                                          keyword: "type",
                                          params: { type: "string" },
                                          message: "must be string",
                                        },
                                      ];
                                      return false;
                                    }
                                    var valid3 = _errs16 === errors;
                                  } else {
                                    var valid3 = true;
                                  }
                                }
                              }
                            }
                          }
                        } else {
                          validate22.errors = [
                            {
                              instancePath: instancePath + "/issues/" + i0,
                              schemaPath:
                                "#/components/schemas/ValidationIssue/type",
                              keyword: "type",
                              params: { type: "object" },
                              message: "must be object",
                            },
                          ];
                          return false;
                        }
                      }
                      var valid1 = _errs8 === errors;
                      if (!valid1) {
                        break;
                      }
                    }
                  } else {
                    validate22.errors = [
                      {
                        instancePath: instancePath + "/issues",
                        schemaPath: "#/properties/issues/type",
                        keyword: "type",
                        params: { type: "array" },
                        message: "must be array",
                      },
                    ];
                    return false;
                  }
                }
                var valid0 = _errs6 === errors;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.currentRevision !== undefined) {
                  let data7 = data.currentRevision;
                  const _errs18 = errors;
                  const _errs19 = errors;
                  let valid4 = false;
                  const _errs20 = errors;
                  if (
                    !(typeof data7 == "number" && !(data7 % 1) && !isNaN(data7))
                  ) {
                    const err0 = {
                      instancePath: instancePath + "/currentRevision",
                      schemaPath: "#/properties/currentRevision/anyOf/0/type",
                      keyword: "type",
                      params: { type: "integer" },
                      message: "must be integer",
                    };
                    if (vErrors === null) {
                      vErrors = [err0];
                    } else {
                      vErrors.push(err0);
                    }
                    errors++;
                  }
                  if (errors === _errs20) {
                    if (typeof data7 == "number") {
                      if (data7 > 2147483647 || isNaN(data7)) {
                        const err1 = {
                          instancePath: instancePath + "/currentRevision",
                          schemaPath:
                            "#/properties/currentRevision/anyOf/0/maximum",
                          keyword: "maximum",
                          params: { comparison: "<=", limit: 2147483647 },
                          message: "must be <= 2147483647",
                        };
                        if (vErrors === null) {
                          vErrors = [err1];
                        } else {
                          vErrors.push(err1);
                        }
                        errors++;
                      } else {
                        if (data7 < 0 || isNaN(data7)) {
                          const err2 = {
                            instancePath: instancePath + "/currentRevision",
                            schemaPath:
                              "#/properties/currentRevision/anyOf/0/minimum",
                            keyword: "minimum",
                            params: { comparison: ">=", limit: 0 },
                            message: "must be >= 0",
                          };
                          if (vErrors === null) {
                            vErrors = [err2];
                          } else {
                            vErrors.push(err2);
                          }
                          errors++;
                        } else {
                          if (!formats0.validate(data7)) {
                            const err3 = {
                              instancePath: instancePath + "/currentRevision",
                              schemaPath:
                                "#/properties/currentRevision/anyOf/0/format",
                              keyword: "format",
                              params: { format: "int32" },
                              message: 'must match format "' + "int32" + '"',
                            };
                            if (vErrors === null) {
                              vErrors = [err3];
                            } else {
                              vErrors.push(err3);
                            }
                            errors++;
                          }
                        }
                      }
                    }
                  }
                  var _valid0 = _errs20 === errors;
                  valid4 = valid4 || _valid0;
                  const _errs22 = errors;
                  if (data7 !== null) {
                    const err4 = {
                      instancePath: instancePath + "/currentRevision",
                      schemaPath: "#/properties/currentRevision/anyOf/1/type",
                      keyword: "type",
                      params: { type: "null" },
                      message: "must be null",
                    };
                    if (vErrors === null) {
                      vErrors = [err4];
                    } else {
                      vErrors.push(err4);
                    }
                    errors++;
                  }
                  var _valid0 = _errs22 === errors;
                  valid4 = valid4 || _valid0;
                  if (!valid4) {
                    const err5 = {
                      instancePath: instancePath + "/currentRevision",
                      schemaPath: "#/properties/currentRevision/anyOf",
                      keyword: "anyOf",
                      params: {},
                      message: "must match a schema in anyOf",
                    };
                    if (vErrors === null) {
                      vErrors = [err5];
                    } else {
                      vErrors.push(err5);
                    }
                    errors++;
                    validate22.errors = vErrors;
                    return false;
                  } else {
                    errors = _errs19;
                    if (vErrors !== null) {
                      if (_errs19) {
                        vErrors.length = _errs19;
                      } else {
                        vErrors = null;
                      }
                    }
                  }
                  var valid0 = _errs18 === errors;
                } else {
                  var valid0 = true;
                }
                if (valid0) {
                  if (data.retryable !== undefined) {
                    const _errs24 = errors;
                    if (typeof data.retryable !== "boolean") {
                      validate22.errors = [
                        {
                          instancePath: instancePath + "/retryable",
                          schemaPath: "#/properties/retryable/type",
                          keyword: "type",
                          params: { type: "boolean" },
                          message: "must be boolean",
                        },
                      ];
                      return false;
                    }
                    var valid0 = _errs24 === errors;
                  } else {
                    var valid0 = true;
                  }
                  if (valid0) {
                    if (data.retryAfterSeconds !== undefined) {
                      let data9 = data.retryAfterSeconds;
                      const _errs26 = errors;
                      const _errs27 = errors;
                      let valid5 = false;
                      const _errs28 = errors;
                      if (
                        !(
                          typeof data9 == "number" &&
                          !(data9 % 1) &&
                          !isNaN(data9)
                        )
                      ) {
                        const err6 = {
                          instancePath: instancePath + "/retryAfterSeconds",
                          schemaPath:
                            "#/properties/retryAfterSeconds/anyOf/0/type",
                          keyword: "type",
                          params: { type: "integer" },
                          message: "must be integer",
                        };
                        if (vErrors === null) {
                          vErrors = [err6];
                        } else {
                          vErrors.push(err6);
                        }
                        errors++;
                      }
                      if (errors === _errs28) {
                        if (typeof data9 == "number") {
                          if (data9 < 0 || isNaN(data9)) {
                            const err7 = {
                              instancePath: instancePath + "/retryAfterSeconds",
                              schemaPath:
                                "#/properties/retryAfterSeconds/anyOf/0/minimum",
                              keyword: "minimum",
                              params: { comparison: ">=", limit: 0 },
                              message: "must be >= 0",
                            };
                            if (vErrors === null) {
                              vErrors = [err7];
                            } else {
                              vErrors.push(err7);
                            }
                            errors++;
                          } else {
                            if (!formats0.validate(data9)) {
                              const err8 = {
                                instancePath:
                                  instancePath + "/retryAfterSeconds",
                                schemaPath:
                                  "#/properties/retryAfterSeconds/anyOf/0/format",
                                keyword: "format",
                                params: { format: "int32" },
                                message: 'must match format "' + "int32" + '"',
                              };
                              if (vErrors === null) {
                                vErrors = [err8];
                              } else {
                                vErrors.push(err8);
                              }
                              errors++;
                            }
                          }
                        }
                      }
                      var _valid1 = _errs28 === errors;
                      valid5 = valid5 || _valid1;
                      const _errs30 = errors;
                      if (data9 !== null) {
                        const err9 = {
                          instancePath: instancePath + "/retryAfterSeconds",
                          schemaPath:
                            "#/properties/retryAfterSeconds/anyOf/1/type",
                          keyword: "type",
                          params: { type: "null" },
                          message: "must be null",
                        };
                        if (vErrors === null) {
                          vErrors = [err9];
                        } else {
                          vErrors.push(err9);
                        }
                        errors++;
                      }
                      var _valid1 = _errs30 === errors;
                      valid5 = valid5 || _valid1;
                      if (!valid5) {
                        const err10 = {
                          instancePath: instancePath + "/retryAfterSeconds",
                          schemaPath: "#/properties/retryAfterSeconds/anyOf",
                          keyword: "anyOf",
                          params: {},
                          message: "must match a schema in anyOf",
                        };
                        if (vErrors === null) {
                          vErrors = [err10];
                        } else {
                          vErrors.push(err10);
                        }
                        errors++;
                        validate22.errors = vErrors;
                        return false;
                      } else {
                        errors = _errs27;
                        if (vErrors !== null) {
                          if (_errs27) {
                            vErrors.length = _errs27;
                          } else {
                            vErrors = null;
                          }
                        }
                      }
                      var valid0 = _errs26 === errors;
                    } else {
                      var valid0 = true;
                    }
                  }
                }
              }
            }
          }
        }
      }
    } else {
      validate22.errors = [
        {
          instancePath,
          schemaPath: "#/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        },
      ];
      return false;
    }
  }
  validate22.errors = vErrors;
  return errors === 0;
}
validate22.evaluated = {
  props: true,
  dynamicProps: false,
  dynamicItems: false,
};
const formats4 = /^(?:urn:uuid:)?[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const formats6 = require("ajv-formats/dist/formats").fullFormats["date-time"];
function validate21(
  data,
  {
    instancePath = "",
    parentData,
    parentDataProperty,
    rootData = data,
    dynamicAnchors = {},
  } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate21.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (errors === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (
        (data.error === undefined && (missing0 = "error")) ||
        (data.meta === undefined && (missing0 = "meta"))
      ) {
        validate21.errors = [
          {
            instancePath,
            schemaPath: "#/required",
            keyword: "required",
            params: { missingProperty: missing0 },
            message: "must have required property '" + missing0 + "'",
          },
        ];
        return false;
      } else {
        const _errs1 = errors;
        for (const key0 in data) {
          if (!(key0 === "error" || key0 === "meta")) {
            validate21.errors = [
              {
                instancePath,
                schemaPath: "#/additionalProperties",
                keyword: "additionalProperties",
                params: { additionalProperty: key0 },
                message: "must NOT have additional properties",
              },
            ];
            return false;
            break;
          }
        }
        if (_errs1 === errors) {
          if (data.error !== undefined) {
            const _errs2 = errors;
            if (
              !validate22(data.error, {
                instancePath: instancePath + "/error",
                parentData: data,
                parentDataProperty: "error",
                rootData,
                dynamicAnchors,
              })
            ) {
              vErrors =
                vErrors === null
                  ? validate22.errors
                  : vErrors.concat(validate22.errors);
              errors = vErrors.length;
            }
            var valid0 = _errs2 === errors;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.meta !== undefined) {
              let data1 = data.meta;
              const _errs3 = errors;
              const _errs4 = errors;
              if (errors === _errs4) {
                if (
                  data1 &&
                  typeof data1 == "object" &&
                  !Array.isArray(data1)
                ) {
                  let missing1;
                  if (
                    (data1.requestId === undefined &&
                      (missing1 = "requestId")) ||
                    (data1.serverTime === undefined &&
                      (missing1 = "serverTime")) ||
                    (data1.apiVersion === undefined &&
                      (missing1 = "apiVersion"))
                  ) {
                    validate21.errors = [
                      {
                        instancePath: instancePath + "/meta",
                        schemaPath: "#/components/schemas/Meta/required",
                        keyword: "required",
                        params: { missingProperty: missing1 },
                        message:
                          "must have required property '" + missing1 + "'",
                      },
                    ];
                    return false;
                  } else {
                    const _errs6 = errors;
                    for (const key1 in data1) {
                      if (
                        !(
                          key1 === "requestId" ||
                          key1 === "serverTime" ||
                          key1 === "apiVersion"
                        )
                      ) {
                        validate21.errors = [
                          {
                            instancePath: instancePath + "/meta",
                            schemaPath:
                              "#/components/schemas/Meta/additionalProperties",
                            keyword: "additionalProperties",
                            params: { additionalProperty: key1 },
                            message: "must NOT have additional properties",
                          },
                        ];
                        return false;
                        break;
                      }
                    }
                    if (_errs6 === errors) {
                      if (data1.requestId !== undefined) {
                        let data2 = data1.requestId;
                        const _errs7 = errors;
                        if (errors === _errs7) {
                          if (errors === _errs7) {
                            if (typeof data2 === "string") {
                              if (!formats4.test(data2)) {
                                validate21.errors = [
                                  {
                                    instancePath:
                                      instancePath + "/meta/requestId",
                                    schemaPath:
                                      "#/components/schemas/Meta/properties/requestId/format",
                                    keyword: "format",
                                    params: { format: "uuid" },
                                    message:
                                      'must match format "' + "uuid" + '"',
                                  },
                                ];
                                return false;
                              }
                            } else {
                              validate21.errors = [
                                {
                                  instancePath:
                                    instancePath + "/meta/requestId",
                                  schemaPath:
                                    "#/components/schemas/Meta/properties/requestId/type",
                                  keyword: "type",
                                  params: { type: "string" },
                                  message: "must be string",
                                },
                              ];
                              return false;
                            }
                          }
                        }
                        var valid2 = _errs7 === errors;
                      } else {
                        var valid2 = true;
                      }
                      if (valid2) {
                        if (data1.serverTime !== undefined) {
                          let data3 = data1.serverTime;
                          const _errs9 = errors;
                          if (errors === _errs9) {
                            if (errors === _errs9) {
                              if (typeof data3 === "string") {
                                if (!formats6.validate(data3)) {
                                  validate21.errors = [
                                    {
                                      instancePath:
                                        instancePath + "/meta/serverTime",
                                      schemaPath:
                                        "#/components/schemas/Meta/properties/serverTime/format",
                                      keyword: "format",
                                      params: { format: "date-time" },
                                      message:
                                        'must match format "' +
                                        "date-time" +
                                        '"',
                                    },
                                  ];
                                  return false;
                                }
                              } else {
                                validate21.errors = [
                                  {
                                    instancePath:
                                      instancePath + "/meta/serverTime",
                                    schemaPath:
                                      "#/components/schemas/Meta/properties/serverTime/type",
                                    keyword: "type",
                                    params: { type: "string" },
                                    message: "must be string",
                                  },
                                ];
                                return false;
                              }
                            }
                          }
                          var valid2 = _errs9 === errors;
                        } else {
                          var valid2 = true;
                        }
                        if (valid2) {
                          if (data1.apiVersion !== undefined) {
                            const _errs11 = errors;
                            if (typeof data1.apiVersion !== "string") {
                              validate21.errors = [
                                {
                                  instancePath:
                                    instancePath + "/meta/apiVersion",
                                  schemaPath:
                                    "#/components/schemas/Meta/properties/apiVersion/type",
                                  keyword: "type",
                                  params: { type: "string" },
                                  message: "must be string",
                                },
                              ];
                              return false;
                            }
                            var valid2 = _errs11 === errors;
                          } else {
                            var valid2 = true;
                          }
                        }
                      }
                    }
                  }
                } else {
                  validate21.errors = [
                    {
                      instancePath: instancePath + "/meta",
                      schemaPath: "#/components/schemas/Meta/type",
                      keyword: "type",
                      params: { type: "object" },
                      message: "must be object",
                    },
                  ];
                  return false;
                }
              }
              var valid0 = _errs3 === errors;
            } else {
              var valid0 = true;
            }
          }
        }
      }
    } else {
      validate21.errors = [
        {
          instancePath,
          schemaPath: "#/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        },
      ];
      return false;
    }
  }
  validate21.errors = vErrors;
  return errors === 0;
}
validate21.evaluated = {
  props: true,
  dynamicProps: false,
  dynamicItems: false,
};
exports.AttemptListEnvelope = validate24;
const schema36 = {
  type: "object",
  additionalProperties: false,
  properties: {
    data: { $ref: "#/components/schemas/ListAttempts" },
    meta: { $ref: "#/components/schemas/Meta" },
  },
  required: ["data", "meta"],
};
const schema37 = {
  type: "object",
  additionalProperties: false,
  properties: {
    items: { type: "array", items: { $ref: "#/components/schemas/Attempt" } },
    nextCursor: { anyOf: [{ type: "string" }, { type: "null" }] },
  },
  required: ["items", "nextCursor"],
};
const schema38 = {
  type: "object",
  additionalProperties: false,
  description:
    "مصدر الحقيقة للحالة الحالية؛ النتائج السابقة تبقى تاريخية ولا تُعد نتائج نشطة بعد التعديل.",
  properties: {
    id: { type: "string", format: "uuid" },
    learningSessionId: { type: "string", format: "uuid" },
    problemRevisionId: { type: "string", format: "uuid" },
    kind: { $ref: "#/components/schemas/AttemptKind" },
    revision: {
      type: "integer",
      format: "int32",
      description:
        "إصدار محاولة، يعادل bigint في PostgreSQL لكنه مقيد هنا إلى Int32 آمن لواجهات JavaScript.",
      minimum: 0,
      maximum: 2147483647,
      example: 4,
    },
    status: { $ref: "#/components/schemas/AttemptStatus" },
    completionVerdict: {
      anyOf: [
        {
          type: "string",
          enum: ["verified_complete", "not_complete", "unknown"],
        },
        { type: "null" },
      ],
    },
    notationProfile: { type: "string" },
    steps: { type: "array", items: { $ref: "#/components/schemas/Step" } },
    openedAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
    parentEpisodeId: {
      anyOf: [{ type: "string", format: "uuid" }, { type: "null" }],
    },
    currentVerification: {
      anyOf: [
        { $ref: "#/components/schemas/VerificationReport" },
        { type: "null" },
      ],
    },
  },
  required: [
    "id",
    "learningSessionId",
    "problemRevisionId",
    "kind",
    "revision",
    "status",
    "completionVerdict",
    "notationProfile",
    "steps",
    "openedAt",
    "updatedAt",
    "parentEpisodeId",
    "currentVerification",
  ],
};
const schema39 = {
  type: "string",
  enum: ["main", "probe", "remediation", "transfer"],
};
const schema40 = {
  type: "string",
  enum: ["in_progress", "completed", "assisted_completed", "stopped"],
};
const func1 = Object.prototype.hasOwnProperty;
const schema41 = {
  type: "object",
  additionalProperties: false,
  properties: {
    id: { type: "string", format: "uuid" },
    position: {
      type: "integer",
      format: "int32",
      description: "ترتيب الطالب يبدأ من 1، ولا تشمل معادلة السؤال الأصلية.",
      minimum: 1,
    },
    currentVersion: { type: "integer", format: "int32", minimum: 1 },
    source: { $ref: "#/components/schemas/MathSource" },
    isActive: { type: "boolean" },
    updatedAt: { type: "string", format: "date-time" },
  },
  required: [
    "id",
    "position",
    "currentVersion",
    "source",
    "isActive",
    "updatedAt",
  ],
};
const schema42 = {
  type: "object",
  additionalProperties: false,
  properties: {
    sourceRaw: {
      type: "string",
      description: "الصيغة العربية كما أدخلها الطالب دون استبدال صامت.",
      maxLength: 256,
      example: "٢س + ٦ = ١٠",
    },
    displayAr: {
      anyOf: [
        {
          type: "string",
          description: "العرض العربي الذي صادق عليه المحرك بعد التحليل.",
        },
        { type: "null" },
      ],
    },
    parseStatus: {
      type: "string",
      description: "حالة التحليل البنيوي.",
      enum: [
        "not_checked",
        "parsed",
        "syntax_error",
        "unsupported",
        "inconclusive",
      ],
    },
  },
  required: ["sourceRaw", "displayAr", "parseStatus"],
};
const func2 = require("ajv/dist/runtime/ucs2length").default;
function validate27(
  data,
  {
    instancePath = "",
    parentData,
    parentDataProperty,
    rootData = data,
    dynamicAnchors = {},
  } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate27.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (errors === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (
        (data.id === undefined && (missing0 = "id")) ||
        (data.position === undefined && (missing0 = "position")) ||
        (data.currentVersion === undefined && (missing0 = "currentVersion")) ||
        (data.source === undefined && (missing0 = "source")) ||
        (data.isActive === undefined && (missing0 = "isActive")) ||
        (data.updatedAt === undefined && (missing0 = "updatedAt"))
      ) {
        validate27.errors = [
          {
            instancePath,
            schemaPath: "#/required",
            keyword: "required",
            params: { missingProperty: missing0 },
            message: "must have required property '" + missing0 + "'",
          },
        ];
        return false;
      } else {
        const _errs1 = errors;
        for (const key0 in data) {
          if (
            !(
              key0 === "id" ||
              key0 === "position" ||
              key0 === "currentVersion" ||
              key0 === "source" ||
              key0 === "isActive" ||
              key0 === "updatedAt"
            )
          ) {
            validate27.errors = [
              {
                instancePath,
                schemaPath: "#/additionalProperties",
                keyword: "additionalProperties",
                params: { additionalProperty: key0 },
                message: "must NOT have additional properties",
              },
            ];
            return false;
            break;
          }
        }
        if (_errs1 === errors) {
          if (data.id !== undefined) {
            let data0 = data.id;
            const _errs2 = errors;
            if (errors === _errs2) {
              if (errors === _errs2) {
                if (typeof data0 === "string") {
                  if (!formats4.test(data0)) {
                    validate27.errors = [
                      {
                        instancePath: instancePath + "/id",
                        schemaPath: "#/properties/id/format",
                        keyword: "format",
                        params: { format: "uuid" },
                        message: 'must match format "' + "uuid" + '"',
                      },
                    ];
                    return false;
                  }
                } else {
                  validate27.errors = [
                    {
                      instancePath: instancePath + "/id",
                      schemaPath: "#/properties/id/type",
                      keyword: "type",
                      params: { type: "string" },
                      message: "must be string",
                    },
                  ];
                  return false;
                }
              }
            }
            var valid0 = _errs2 === errors;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.position !== undefined) {
              let data1 = data.position;
              const _errs4 = errors;
              if (
                !(typeof data1 == "number" && !(data1 % 1) && !isNaN(data1))
              ) {
                validate27.errors = [
                  {
                    instancePath: instancePath + "/position",
                    schemaPath: "#/properties/position/type",
                    keyword: "type",
                    params: { type: "integer" },
                    message: "must be integer",
                  },
                ];
                return false;
              }
              if (errors === _errs4) {
                if (typeof data1 == "number") {
                  if (data1 < 1 || isNaN(data1)) {
                    validate27.errors = [
                      {
                        instancePath: instancePath + "/position",
                        schemaPath: "#/properties/position/minimum",
                        keyword: "minimum",
                        params: { comparison: ">=", limit: 1 },
                        message: "must be >= 1",
                      },
                    ];
                    return false;
                  } else {
                    if (!formats0.validate(data1)) {
                      validate27.errors = [
                        {
                          instancePath: instancePath + "/position",
                          schemaPath: "#/properties/position/format",
                          keyword: "format",
                          params: { format: "int32" },
                          message: 'must match format "' + "int32" + '"',
                        },
                      ];
                      return false;
                    }
                  }
                }
              }
              var valid0 = _errs4 === errors;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.currentVersion !== undefined) {
                let data2 = data.currentVersion;
                const _errs6 = errors;
                if (
                  !(typeof data2 == "number" && !(data2 % 1) && !isNaN(data2))
                ) {
                  validate27.errors = [
                    {
                      instancePath: instancePath + "/currentVersion",
                      schemaPath: "#/properties/currentVersion/type",
                      keyword: "type",
                      params: { type: "integer" },
                      message: "must be integer",
                    },
                  ];
                  return false;
                }
                if (errors === _errs6) {
                  if (typeof data2 == "number") {
                    if (data2 < 1 || isNaN(data2)) {
                      validate27.errors = [
                        {
                          instancePath: instancePath + "/currentVersion",
                          schemaPath: "#/properties/currentVersion/minimum",
                          keyword: "minimum",
                          params: { comparison: ">=", limit: 1 },
                          message: "must be >= 1",
                        },
                      ];
                      return false;
                    } else {
                      if (!formats0.validate(data2)) {
                        validate27.errors = [
                          {
                            instancePath: instancePath + "/currentVersion",
                            schemaPath: "#/properties/currentVersion/format",
                            keyword: "format",
                            params: { format: "int32" },
                            message: 'must match format "' + "int32" + '"',
                          },
                        ];
                        return false;
                      }
                    }
                  }
                }
                var valid0 = _errs6 === errors;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.source !== undefined) {
                  let data3 = data.source;
                  const _errs8 = errors;
                  const _errs9 = errors;
                  if (errors === _errs9) {
                    if (
                      data3 &&
                      typeof data3 == "object" &&
                      !Array.isArray(data3)
                    ) {
                      let missing1;
                      if (
                        (data3.sourceRaw === undefined &&
                          (missing1 = "sourceRaw")) ||
                        (data3.displayAr === undefined &&
                          (missing1 = "displayAr")) ||
                        (data3.parseStatus === undefined &&
                          (missing1 = "parseStatus"))
                      ) {
                        validate27.errors = [
                          {
                            instancePath: instancePath + "/source",
                            schemaPath:
                              "#/components/schemas/MathSource/required",
                            keyword: "required",
                            params: { missingProperty: missing1 },
                            message:
                              "must have required property '" + missing1 + "'",
                          },
                        ];
                        return false;
                      } else {
                        const _errs11 = errors;
                        for (const key1 in data3) {
                          if (
                            !(
                              key1 === "sourceRaw" ||
                              key1 === "displayAr" ||
                              key1 === "parseStatus"
                            )
                          ) {
                            validate27.errors = [
                              {
                                instancePath: instancePath + "/source",
                                schemaPath:
                                  "#/components/schemas/MathSource/additionalProperties",
                                keyword: "additionalProperties",
                                params: { additionalProperty: key1 },
                                message: "must NOT have additional properties",
                              },
                            ];
                            return false;
                            break;
                          }
                        }
                        if (_errs11 === errors) {
                          if (data3.sourceRaw !== undefined) {
                            let data4 = data3.sourceRaw;
                            const _errs12 = errors;
                            if (errors === _errs12) {
                              if (typeof data4 === "string") {
                                if (func2(data4) > 256) {
                                  validate27.errors = [
                                    {
                                      instancePath:
                                        instancePath + "/source/sourceRaw",
                                      schemaPath:
                                        "#/components/schemas/MathSource/properties/sourceRaw/maxLength",
                                      keyword: "maxLength",
                                      params: { limit: 256 },
                                      message:
                                        "must NOT have more than 256 characters",
                                    },
                                  ];
                                  return false;
                                }
                              } else {
                                validate27.errors = [
                                  {
                                    instancePath:
                                      instancePath + "/source/sourceRaw",
                                    schemaPath:
                                      "#/components/schemas/MathSource/properties/sourceRaw/type",
                                    keyword: "type",
                                    params: { type: "string" },
                                    message: "must be string",
                                  },
                                ];
                                return false;
                              }
                            }
                            var valid2 = _errs12 === errors;
                          } else {
                            var valid2 = true;
                          }
                          if (valid2) {
                            if (data3.displayAr !== undefined) {
                              let data5 = data3.displayAr;
                              const _errs14 = errors;
                              const _errs15 = errors;
                              let valid3 = false;
                              const _errs16 = errors;
                              if (typeof data5 !== "string") {
                                const err0 = {
                                  instancePath:
                                    instancePath + "/source/displayAr",
                                  schemaPath:
                                    "#/components/schemas/MathSource/properties/displayAr/anyOf/0/type",
                                  keyword: "type",
                                  params: { type: "string" },
                                  message: "must be string",
                                };
                                if (vErrors === null) {
                                  vErrors = [err0];
                                } else {
                                  vErrors.push(err0);
                                }
                                errors++;
                              }
                              var _valid0 = _errs16 === errors;
                              valid3 = valid3 || _valid0;
                              const _errs18 = errors;
                              if (data5 !== null) {
                                const err1 = {
                                  instancePath:
                                    instancePath + "/source/displayAr",
                                  schemaPath:
                                    "#/components/schemas/MathSource/properties/displayAr/anyOf/1/type",
                                  keyword: "type",
                                  params: { type: "null" },
                                  message: "must be null",
                                };
                                if (vErrors === null) {
                                  vErrors = [err1];
                                } else {
                                  vErrors.push(err1);
                                }
                                errors++;
                              }
                              var _valid0 = _errs18 === errors;
                              valid3 = valid3 || _valid0;
                              if (!valid3) {
                                const err2 = {
                                  instancePath:
                                    instancePath + "/source/displayAr",
                                  schemaPath:
                                    "#/components/schemas/MathSource/properties/displayAr/anyOf",
                                  keyword: "anyOf",
                                  params: {},
                                  message: "must match a schema in anyOf",
                                };
                                if (vErrors === null) {
                                  vErrors = [err2];
                                } else {
                                  vErrors.push(err2);
                                }
                                errors++;
                                validate27.errors = vErrors;
                                return false;
                              } else {
                                errors = _errs15;
                                if (vErrors !== null) {
                                  if (_errs15) {
                                    vErrors.length = _errs15;
                                  } else {
                                    vErrors = null;
                                  }
                                }
                              }
                              var valid2 = _errs14 === errors;
                            } else {
                              var valid2 = true;
                            }
                            if (valid2) {
                              if (data3.parseStatus !== undefined) {
                                let data6 = data3.parseStatus;
                                const _errs20 = errors;
                                if (typeof data6 !== "string") {
                                  validate27.errors = [
                                    {
                                      instancePath:
                                        instancePath + "/source/parseStatus",
                                      schemaPath:
                                        "#/components/schemas/MathSource/properties/parseStatus/type",
                                      keyword: "type",
                                      params: { type: "string" },
                                      message: "must be string",
                                    },
                                  ];
                                  return false;
                                }
                                if (
                                  !(
                                    data6 === "not_checked" ||
                                    data6 === "parsed" ||
                                    data6 === "syntax_error" ||
                                    data6 === "unsupported" ||
                                    data6 === "inconclusive"
                                  )
                                ) {
                                  validate27.errors = [
                                    {
                                      instancePath:
                                        instancePath + "/source/parseStatus",
                                      schemaPath:
                                        "#/components/schemas/MathSource/properties/parseStatus/enum",
                                      keyword: "enum",
                                      params: {
                                        allowedValues:
                                          schema42.properties.parseStatus.enum,
                                      },
                                      message:
                                        "must be equal to one of the allowed values",
                                    },
                                  ];
                                  return false;
                                }
                                var valid2 = _errs20 === errors;
                              } else {
                                var valid2 = true;
                              }
                            }
                          }
                        }
                      }
                    } else {
                      validate27.errors = [
                        {
                          instancePath: instancePath + "/source",
                          schemaPath: "#/components/schemas/MathSource/type",
                          keyword: "type",
                          params: { type: "object" },
                          message: "must be object",
                        },
                      ];
                      return false;
                    }
                  }
                  var valid0 = _errs8 === errors;
                } else {
                  var valid0 = true;
                }
                if (valid0) {
                  if (data.isActive !== undefined) {
                    const _errs22 = errors;
                    if (typeof data.isActive !== "boolean") {
                      validate27.errors = [
                        {
                          instancePath: instancePath + "/isActive",
                          schemaPath: "#/properties/isActive/type",
                          keyword: "type",
                          params: { type: "boolean" },
                          message: "must be boolean",
                        },
                      ];
                      return false;
                    }
                    var valid0 = _errs22 === errors;
                  } else {
                    var valid0 = true;
                  }
                  if (valid0) {
                    if (data.updatedAt !== undefined) {
                      let data8 = data.updatedAt;
                      const _errs24 = errors;
                      if (errors === _errs24) {
                        if (errors === _errs24) {
                          if (typeof data8 === "string") {
                            if (!formats6.validate(data8)) {
                              validate27.errors = [
                                {
                                  instancePath: instancePath + "/updatedAt",
                                  schemaPath: "#/properties/updatedAt/format",
                                  keyword: "format",
                                  params: { format: "date-time" },
                                  message:
                                    'must match format "' + "date-time" + '"',
                                },
                              ];
                              return false;
                            }
                          } else {
                            validate27.errors = [
                              {
                                instancePath: instancePath + "/updatedAt",
                                schemaPath: "#/properties/updatedAt/type",
                                keyword: "type",
                                params: { type: "string" },
                                message: "must be string",
                              },
                            ];
                            return false;
                          }
                        }
                      }
                      var valid0 = _errs24 === errors;
                    } else {
                      var valid0 = true;
                    }
                  }
                }
              }
            }
          }
        }
      }
    } else {
      validate27.errors = [
        {
          instancePath,
          schemaPath: "#/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        },
      ];
      return false;
    }
  }
  validate27.errors = vErrors;
  return errors === 0;
}
validate27.evaluated = {
  props: true,
  dynamicProps: false,
  dynamicItems: false,
};
const schema43 = {
  type: "object",
  additionalProperties: false,
  properties: {
    id: { type: "string", description: "معرّف تشغيل التحقق.", format: "uuid" },
    attemptId: { type: "string", format: "uuid" },
    attemptRevision: {
      type: "integer",
      format: "int32",
      description:
        "إصدار محاولة، يعادل bigint في PostgreSQL لكنه مقيد هنا إلى Int32 آمن لواجهات JavaScript.",
      minimum: 0,
      maximum: 2147483647,
      example: 4,
    },
    problemRevisionId: { type: "string", format: "uuid" },
    scope: { $ref: "#/components/schemas/VerificationScope" },
    isCurrent: {
      type: "boolean",
      description: "يجب أن تكون true في استجابة ناجحة حديثة؛ القديمة تعاد 409.",
    },
    transitions: {
      type: "array",
      items: { $ref: "#/components/schemas/TransitionVerdict" },
      minItems: 1,
    },
    firstBlockingTransitionIndex: {
      anyOf: [
        { type: "integer", format: "int32", minimum: 0 },
        { type: "null" },
      ],
    },
    completion: { $ref: "#/components/schemas/Completion" },
    diagnosisCandidate: {
      anyOf: [
        { $ref: "#/components/schemas/DiagnosisCandidate" },
        { type: "null" },
      ],
    },
  },
  required: [
    "id",
    "attemptId",
    "attemptRevision",
    "problemRevisionId",
    "scope",
    "isCurrent",
    "transitions",
    "firstBlockingTransitionIndex",
    "completion",
    "diagnosisCandidate",
  ],
};
const schema44 = {
  type: "string",
  description: "التحقق من انتقال واحد أو السلسلة كاملة.",
  enum: ["target_edge", "current_sequence"],
};
const schema53 = {
  type: "object",
  additionalProperties: false,
  properties: {
    state: {
      type: "string",
      enum: ["not_complete", "verified_complete", "unknown"],
    },
    canMarkAttemptCompleted: { type: "boolean" },
    explanationAr: { type: "string" },
  },
  required: ["state", "canMarkAttemptCompleted", "explanationAr"],
};
const schema45 = {
  type: "object",
  additionalProperties: false,
  properties: {
    verificationResultId: { type: "string", format: "uuid" },
    from: {
      type: "object",
      additionalProperties: false,
      properties: {
        kind: { type: "string", enum: ["problem", "step"] },
        stepId: {
          anyOf: [{ type: "string", format: "uuid" }, { type: "null" }],
        },
        stepVersion: {
          anyOf: [
            { type: "integer", format: "int32", minimum: 1 },
            { type: "null" },
          ],
        },
      },
      required: ["kind", "stepId", "stepVersion"],
    },
    to: {
      type: "object",
      additionalProperties: false,
      properties: {
        stepId: { type: "string", format: "uuid" },
        stepVersion: { type: "integer", format: "int32", minimum: 1 },
      },
      required: ["stepId", "stepVersion"],
    },
    mathStatus: { $ref: "#/components/schemas/MathStatus" },
    reasonCode: { anyOf: [{ type: "string" }, { type: "null" }] },
    issue: {
      anyOf: [{ $ref: "#/components/schemas/MathIssue" }, { type: "null" }],
    },
    evidence: {
      anyOf: [{ $ref: "#/components/schemas/MathEvidence" }, { type: "null" }],
    },
    engineVersion: { type: "string" },
    notationProfileVersion: { type: "string" },
  },
  required: [
    "verificationResultId",
    "from",
    "to",
    "mathStatus",
    "reasonCode",
    "issue",
    "evidence",
    "engineVersion",
    "notationProfileVersion",
  ],
};
const schema46 = {
  type: "string",
  description: "حكم محرك الرياضيات؛ لا يساوي تشخيصًا تربويًا.",
  enum: [
    "verified_valid",
    "verified_invalid",
    "syntax_error",
    "unsupported",
    "inconclusive",
    "service_error",
  ],
};
const schema47 = {
  type: "object",
  additionalProperties: false,
  properties: {
    reasonCode: {
      type: "string",
      description: "رمز ثابت مثل AMBIGUOUS_DIVISION.",
      maxLength: 80,
    },
    messageAr: {
      type: "string",
      description: "رسالة عربية قابلة للعرض دون traceback.",
    },
    spanStart: {
      anyOf: [
        {
          type: "integer",
          format: "int32",
          description: "موضع البداية بوحدات Unicode code points.",
          minimum: 0,
        },
        { type: "null" },
      ],
    },
    spanEnd: {
      anyOf: [
        {
          type: "integer",
          format: "int32",
          description: "نهاية المدى حصريًا.",
          minimum: 0,
        },
        { type: "null" },
      ],
    },
    spanUnit: { type: "string", enum: ["unicode_codepoint"] },
    hintKey: {
      anyOf: [
        { type: "string", description: "مفتاح رسالة توجيهية.", maxLength: 80 },
        { type: "null" },
      ],
    },
  },
  required: [
    "reasonCode",
    "messageAr",
    "spanStart",
    "spanEnd",
    "spanUnit",
    "hintKey",
  ],
};
const schema48 = {
  type: "object",
  additionalProperties: false,
  properties: {
    kind: {
      type: "string",
      enum: ["counterexample", "solution_set", "rule_violation", "none"],
    },
    domain: { type: "string", enum: ["reals"] },
    previousSolution: {
      anyOf: [{ $ref: "#/components/schemas/SolutionSet" }, { type: "null" }],
    },
    nextSolution: {
      anyOf: [{ $ref: "#/components/schemas/SolutionSet" }, { type: "null" }],
    },
    witness: {
      anyOf: [
        { $ref: "#/components/schemas/Counterexample" },
        { type: "null" },
      ],
    },
    summaryAr: {
      anyOf: [
        {
          type: "string",
          description: "شرح الدليل بعد التحقق الرياضي، وليس توليدًا غير موثق.",
        },
        { type: "null" },
      ],
    },
  },
  required: [
    "kind",
    "domain",
    "previousSolution",
    "nextSolution",
    "witness",
    "summaryAr",
  ],
};
const schema49 = {
  type: "object",
  additionalProperties: false,
  properties: {
    kind: {
      type: "string",
      description: "مجموعة حل المعادلة الخطية ضمن الأعداد الحقيقية.",
      enum: ["singleton", "all_reals", "empty"],
    },
    value: {
      anyOf: [{ $ref: "#/components/schemas/Rational" }, { type: "null" }],
    },
  },
  required: ["kind", "value"],
};
const schema50 = {
  type: "object",
  additionalProperties: false,
  description: "تمثيل دقيق للنسب؛ لا تستخدم float.",
  properties: {
    num: {
      type: "string",
      description: "البسط العشري كنص صحيح موقع.",
      pattern: "^-?(0|[1-9][0-9]*)$",
      example: "2",
    },
    den: {
      type: "string",
      description: "المقام العشري كنص صحيح موجب، ولا يساوي صفرًا.",
      pattern: "^[1-9][0-9]*$",
      example: "1",
    },
  },
  required: ["num", "den"],
};
const pattern4 = new RegExp("^-?(0|[1-9][0-9]*)$", "u");
const pattern5 = new RegExp("^[1-9][0-9]*$", "u");
function validate32(
  data,
  {
    instancePath = "",
    parentData,
    parentDataProperty,
    rootData = data,
    dynamicAnchors = {},
  } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate32.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (errors === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (
        (data.kind === undefined && (missing0 = "kind")) ||
        (data.value === undefined && (missing0 = "value"))
      ) {
        validate32.errors = [
          {
            instancePath,
            schemaPath: "#/required",
            keyword: "required",
            params: { missingProperty: missing0 },
            message: "must have required property '" + missing0 + "'",
          },
        ];
        return false;
      } else {
        const _errs1 = errors;
        for (const key0 in data) {
          if (!(key0 === "kind" || key0 === "value")) {
            validate32.errors = [
              {
                instancePath,
                schemaPath: "#/additionalProperties",
                keyword: "additionalProperties",
                params: { additionalProperty: key0 },
                message: "must NOT have additional properties",
              },
            ];
            return false;
            break;
          }
        }
        if (_errs1 === errors) {
          if (data.kind !== undefined) {
            let data0 = data.kind;
            const _errs2 = errors;
            if (typeof data0 !== "string") {
              validate32.errors = [
                {
                  instancePath: instancePath + "/kind",
                  schemaPath: "#/properties/kind/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                },
              ];
              return false;
            }
            if (
              !(
                data0 === "singleton" ||
                data0 === "all_reals" ||
                data0 === "empty"
              )
            ) {
              validate32.errors = [
                {
                  instancePath: instancePath + "/kind",
                  schemaPath: "#/properties/kind/enum",
                  keyword: "enum",
                  params: { allowedValues: schema49.properties.kind.enum },
                  message: "must be equal to one of the allowed values",
                },
              ];
              return false;
            }
            var valid0 = _errs2 === errors;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.value !== undefined) {
              let data1 = data.value;
              const _errs4 = errors;
              const _errs5 = errors;
              let valid1 = false;
              const _errs6 = errors;
              const _errs7 = errors;
              if (errors === _errs7) {
                if (
                  data1 &&
                  typeof data1 == "object" &&
                  !Array.isArray(data1)
                ) {
                  let missing1;
                  if (
                    (data1.num === undefined && (missing1 = "num")) ||
                    (data1.den === undefined && (missing1 = "den"))
                  ) {
                    const err0 = {
                      instancePath: instancePath + "/value",
                      schemaPath: "#/components/schemas/Rational/required",
                      keyword: "required",
                      params: { missingProperty: missing1 },
                      message: "must have required property '" + missing1 + "'",
                    };
                    if (vErrors === null) {
                      vErrors = [err0];
                    } else {
                      vErrors.push(err0);
                    }
                    errors++;
                  } else {
                    const _errs9 = errors;
                    for (const key1 in data1) {
                      if (!(key1 === "num" || key1 === "den")) {
                        const err1 = {
                          instancePath: instancePath + "/value",
                          schemaPath:
                            "#/components/schemas/Rational/additionalProperties",
                          keyword: "additionalProperties",
                          params: { additionalProperty: key1 },
                          message: "must NOT have additional properties",
                        };
                        if (vErrors === null) {
                          vErrors = [err1];
                        } else {
                          vErrors.push(err1);
                        }
                        errors++;
                        break;
                      }
                    }
                    if (_errs9 === errors) {
                      if (data1.num !== undefined) {
                        let data2 = data1.num;
                        const _errs10 = errors;
                        if (errors === _errs10) {
                          if (typeof data2 === "string") {
                            if (!pattern4.test(data2)) {
                              const err2 = {
                                instancePath: instancePath + "/value/num",
                                schemaPath:
                                  "#/components/schemas/Rational/properties/num/pattern",
                                keyword: "pattern",
                                params: { pattern: "^-?(0|[1-9][0-9]*)$" },
                                message:
                                  'must match pattern "' +
                                  "^-?(0|[1-9][0-9]*)$" +
                                  '"',
                              };
                              if (vErrors === null) {
                                vErrors = [err2];
                              } else {
                                vErrors.push(err2);
                              }
                              errors++;
                            }
                          } else {
                            const err3 = {
                              instancePath: instancePath + "/value/num",
                              schemaPath:
                                "#/components/schemas/Rational/properties/num/type",
                              keyword: "type",
                              params: { type: "string" },
                              message: "must be string",
                            };
                            if (vErrors === null) {
                              vErrors = [err3];
                            } else {
                              vErrors.push(err3);
                            }
                            errors++;
                          }
                        }
                        var valid3 = _errs10 === errors;
                      } else {
                        var valid3 = true;
                      }
                      if (valid3) {
                        if (data1.den !== undefined) {
                          let data3 = data1.den;
                          const _errs12 = errors;
                          if (errors === _errs12) {
                            if (typeof data3 === "string") {
                              if (!pattern5.test(data3)) {
                                const err4 = {
                                  instancePath: instancePath + "/value/den",
                                  schemaPath:
                                    "#/components/schemas/Rational/properties/den/pattern",
                                  keyword: "pattern",
                                  params: { pattern: "^[1-9][0-9]*$" },
                                  message:
                                    'must match pattern "' +
                                    "^[1-9][0-9]*$" +
                                    '"',
                                };
                                if (vErrors === null) {
                                  vErrors = [err4];
                                } else {
                                  vErrors.push(err4);
                                }
                                errors++;
                              }
                            } else {
                              const err5 = {
                                instancePath: instancePath + "/value/den",
                                schemaPath:
                                  "#/components/schemas/Rational/properties/den/type",
                                keyword: "type",
                                params: { type: "string" },
                                message: "must be string",
                              };
                              if (vErrors === null) {
                                vErrors = [err5];
                              } else {
                                vErrors.push(err5);
                              }
                              errors++;
                            }
                          }
                          var valid3 = _errs12 === errors;
                        } else {
                          var valid3 = true;
                        }
                      }
                    }
                  }
                } else {
                  const err6 = {
                    instancePath: instancePath + "/value",
                    schemaPath: "#/components/schemas/Rational/type",
                    keyword: "type",
                    params: { type: "object" },
                    message: "must be object",
                  };
                  if (vErrors === null) {
                    vErrors = [err6];
                  } else {
                    vErrors.push(err6);
                  }
                  errors++;
                }
              }
              var _valid0 = _errs6 === errors;
              valid1 = valid1 || _valid0;
              const _errs14 = errors;
              if (data1 !== null) {
                const err7 = {
                  instancePath: instancePath + "/value",
                  schemaPath: "#/properties/value/anyOf/1/type",
                  keyword: "type",
                  params: { type: "null" },
                  message: "must be null",
                };
                if (vErrors === null) {
                  vErrors = [err7];
                } else {
                  vErrors.push(err7);
                }
                errors++;
              }
              var _valid0 = _errs14 === errors;
              valid1 = valid1 || _valid0;
              if (!valid1) {
                const err8 = {
                  instancePath: instancePath + "/value",
                  schemaPath: "#/properties/value/anyOf",
                  keyword: "anyOf",
                  params: {},
                  message: "must match a schema in anyOf",
                };
                if (vErrors === null) {
                  vErrors = [err8];
                } else {
                  vErrors.push(err8);
                }
                errors++;
                validate32.errors = vErrors;
                return false;
              } else {
                errors = _errs5;
                if (vErrors !== null) {
                  if (_errs5) {
                    vErrors.length = _errs5;
                  } else {
                    vErrors = null;
                  }
                }
              }
              var valid0 = _errs4 === errors;
            } else {
              var valid0 = true;
            }
          }
        }
      }
    } else {
      validate32.errors = [
        {
          instancePath,
          schemaPath: "#/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        },
      ];
      return false;
    }
  }
  validate32.errors = vErrors;
  return errors === 0;
}
validate32.evaluated = {
  props: true,
  dynamicProps: false,
  dynamicItems: false,
};
const schema51 = {
  type: "object",
  additionalProperties: false,
  properties: {
    variable: { type: "string", enum: ["س"] },
    value: { $ref: "#/components/schemas/Rational" },
    satisfiesPrevious: { type: "boolean" },
    satisfiesNext: { type: "boolean" },
  },
  required: ["variable", "value", "satisfiesPrevious", "satisfiesNext"],
};
function validate35(
  data,
  {
    instancePath = "",
    parentData,
    parentDataProperty,
    rootData = data,
    dynamicAnchors = {},
  } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate35.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (errors === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (
        (data.variable === undefined && (missing0 = "variable")) ||
        (data.value === undefined && (missing0 = "value")) ||
        (data.satisfiesPrevious === undefined &&
          (missing0 = "satisfiesPrevious")) ||
        (data.satisfiesNext === undefined && (missing0 = "satisfiesNext"))
      ) {
        validate35.errors = [
          {
            instancePath,
            schemaPath: "#/required",
            keyword: "required",
            params: { missingProperty: missing0 },
            message: "must have required property '" + missing0 + "'",
          },
        ];
        return false;
      } else {
        const _errs1 = errors;
        for (const key0 in data) {
          if (
            !(
              key0 === "variable" ||
              key0 === "value" ||
              key0 === "satisfiesPrevious" ||
              key0 === "satisfiesNext"
            )
          ) {
            validate35.errors = [
              {
                instancePath,
                schemaPath: "#/additionalProperties",
                keyword: "additionalProperties",
                params: { additionalProperty: key0 },
                message: "must NOT have additional properties",
              },
            ];
            return false;
            break;
          }
        }
        if (_errs1 === errors) {
          if (data.variable !== undefined) {
            let data0 = data.variable;
            const _errs2 = errors;
            if (typeof data0 !== "string") {
              validate35.errors = [
                {
                  instancePath: instancePath + "/variable",
                  schemaPath: "#/properties/variable/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                },
              ];
              return false;
            }
            if (!(data0 === "س")) {
              validate35.errors = [
                {
                  instancePath: instancePath + "/variable",
                  schemaPath: "#/properties/variable/enum",
                  keyword: "enum",
                  params: { allowedValues: schema51.properties.variable.enum },
                  message: "must be equal to one of the allowed values",
                },
              ];
              return false;
            }
            var valid0 = _errs2 === errors;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.value !== undefined) {
              let data1 = data.value;
              const _errs4 = errors;
              const _errs5 = errors;
              if (errors === _errs5) {
                if (
                  data1 &&
                  typeof data1 == "object" &&
                  !Array.isArray(data1)
                ) {
                  let missing1;
                  if (
                    (data1.num === undefined && (missing1 = "num")) ||
                    (data1.den === undefined && (missing1 = "den"))
                  ) {
                    validate35.errors = [
                      {
                        instancePath: instancePath + "/value",
                        schemaPath: "#/components/schemas/Rational/required",
                        keyword: "required",
                        params: { missingProperty: missing1 },
                        message:
                          "must have required property '" + missing1 + "'",
                      },
                    ];
                    return false;
                  } else {
                    const _errs7 = errors;
                    for (const key1 in data1) {
                      if (!(key1 === "num" || key1 === "den")) {
                        validate35.errors = [
                          {
                            instancePath: instancePath + "/value",
                            schemaPath:
                              "#/components/schemas/Rational/additionalProperties",
                            keyword: "additionalProperties",
                            params: { additionalProperty: key1 },
                            message: "must NOT have additional properties",
                          },
                        ];
                        return false;
                        break;
                      }
                    }
                    if (_errs7 === errors) {
                      if (data1.num !== undefined) {
                        let data2 = data1.num;
                        const _errs8 = errors;
                        if (errors === _errs8) {
                          if (typeof data2 === "string") {
                            if (!pattern4.test(data2)) {
                              validate35.errors = [
                                {
                                  instancePath: instancePath + "/value/num",
                                  schemaPath:
                                    "#/components/schemas/Rational/properties/num/pattern",
                                  keyword: "pattern",
                                  params: { pattern: "^-?(0|[1-9][0-9]*)$" },
                                  message:
                                    'must match pattern "' +
                                    "^-?(0|[1-9][0-9]*)$" +
                                    '"',
                                },
                              ];
                              return false;
                            }
                          } else {
                            validate35.errors = [
                              {
                                instancePath: instancePath + "/value/num",
                                schemaPath:
                                  "#/components/schemas/Rational/properties/num/type",
                                keyword: "type",
                                params: { type: "string" },
                                message: "must be string",
                              },
                            ];
                            return false;
                          }
                        }
                        var valid2 = _errs8 === errors;
                      } else {
                        var valid2 = true;
                      }
                      if (valid2) {
                        if (data1.den !== undefined) {
                          let data3 = data1.den;
                          const _errs10 = errors;
                          if (errors === _errs10) {
                            if (typeof data3 === "string") {
                              if (!pattern5.test(data3)) {
                                validate35.errors = [
                                  {
                                    instancePath: instancePath + "/value/den",
                                    schemaPath:
                                      "#/components/schemas/Rational/properties/den/pattern",
                                    keyword: "pattern",
                                    params: { pattern: "^[1-9][0-9]*$" },
                                    message:
                                      'must match pattern "' +
                                      "^[1-9][0-9]*$" +
                                      '"',
                                  },
                                ];
                                return false;
                              }
                            } else {
                              validate35.errors = [
                                {
                                  instancePath: instancePath + "/value/den",
                                  schemaPath:
                                    "#/components/schemas/Rational/properties/den/type",
                                  keyword: "type",
                                  params: { type: "string" },
                                  message: "must be string",
                                },
                              ];
                              return false;
                            }
                          }
                          var valid2 = _errs10 === errors;
                        } else {
                          var valid2 = true;
                        }
                      }
                    }
                  }
                } else {
                  validate35.errors = [
                    {
                      instancePath: instancePath + "/value",
                      schemaPath: "#/components/schemas/Rational/type",
                      keyword: "type",
                      params: { type: "object" },
                      message: "must be object",
                    },
                  ];
                  return false;
                }
              }
              var valid0 = _errs4 === errors;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.satisfiesPrevious !== undefined) {
                const _errs12 = errors;
                if (typeof data.satisfiesPrevious !== "boolean") {
                  validate35.errors = [
                    {
                      instancePath: instancePath + "/satisfiesPrevious",
                      schemaPath: "#/properties/satisfiesPrevious/type",
                      keyword: "type",
                      params: { type: "boolean" },
                      message: "must be boolean",
                    },
                  ];
                  return false;
                }
                var valid0 = _errs12 === errors;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.satisfiesNext !== undefined) {
                  const _errs14 = errors;
                  if (typeof data.satisfiesNext !== "boolean") {
                    validate35.errors = [
                      {
                        instancePath: instancePath + "/satisfiesNext",
                        schemaPath: "#/properties/satisfiesNext/type",
                        keyword: "type",
                        params: { type: "boolean" },
                        message: "must be boolean",
                      },
                    ];
                    return false;
                  }
                  var valid0 = _errs14 === errors;
                } else {
                  var valid0 = true;
                }
              }
            }
          }
        }
      }
    } else {
      validate35.errors = [
        {
          instancePath,
          schemaPath: "#/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        },
      ];
      return false;
    }
  }
  validate35.errors = vErrors;
  return errors === 0;
}
validate35.evaluated = {
  props: true,
  dynamicProps: false,
  dynamicItems: false,
};
function validate31(
  data,
  {
    instancePath = "",
    parentData,
    parentDataProperty,
    rootData = data,
    dynamicAnchors = {},
  } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate31.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (errors === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (
        (data.kind === undefined && (missing0 = "kind")) ||
        (data.domain === undefined && (missing0 = "domain")) ||
        (data.previousSolution === undefined &&
          (missing0 = "previousSolution")) ||
        (data.nextSolution === undefined && (missing0 = "nextSolution")) ||
        (data.witness === undefined && (missing0 = "witness")) ||
        (data.summaryAr === undefined && (missing0 = "summaryAr"))
      ) {
        validate31.errors = [
          {
            instancePath,
            schemaPath: "#/required",
            keyword: "required",
            params: { missingProperty: missing0 },
            message: "must have required property '" + missing0 + "'",
          },
        ];
        return false;
      } else {
        const _errs1 = errors;
        for (const key0 in data) {
          if (
            !(
              key0 === "kind" ||
              key0 === "domain" ||
              key0 === "previousSolution" ||
              key0 === "nextSolution" ||
              key0 === "witness" ||
              key0 === "summaryAr"
            )
          ) {
            validate31.errors = [
              {
                instancePath,
                schemaPath: "#/additionalProperties",
                keyword: "additionalProperties",
                params: { additionalProperty: key0 },
                message: "must NOT have additional properties",
              },
            ];
            return false;
            break;
          }
        }
        if (_errs1 === errors) {
          if (data.kind !== undefined) {
            let data0 = data.kind;
            const _errs2 = errors;
            if (typeof data0 !== "string") {
              validate31.errors = [
                {
                  instancePath: instancePath + "/kind",
                  schemaPath: "#/properties/kind/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                },
              ];
              return false;
            }
            if (
              !(
                data0 === "counterexample" ||
                data0 === "solution_set" ||
                data0 === "rule_violation" ||
                data0 === "none"
              )
            ) {
              validate31.errors = [
                {
                  instancePath: instancePath + "/kind",
                  schemaPath: "#/properties/kind/enum",
                  keyword: "enum",
                  params: { allowedValues: schema48.properties.kind.enum },
                  message: "must be equal to one of the allowed values",
                },
              ];
              return false;
            }
            var valid0 = _errs2 === errors;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.domain !== undefined) {
              let data1 = data.domain;
              const _errs4 = errors;
              if (typeof data1 !== "string") {
                validate31.errors = [
                  {
                    instancePath: instancePath + "/domain",
                    schemaPath: "#/properties/domain/type",
                    keyword: "type",
                    params: { type: "string" },
                    message: "must be string",
                  },
                ];
                return false;
              }
              if (!(data1 === "reals")) {
                validate31.errors = [
                  {
                    instancePath: instancePath + "/domain",
                    schemaPath: "#/properties/domain/enum",
                    keyword: "enum",
                    params: { allowedValues: schema48.properties.domain.enum },
                    message: "must be equal to one of the allowed values",
                  },
                ];
                return false;
              }
              var valid0 = _errs4 === errors;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.previousSolution !== undefined) {
                let data2 = data.previousSolution;
                const _errs6 = errors;
                const _errs7 = errors;
                let valid1 = false;
                const _errs8 = errors;
                if (
                  !validate32(data2, {
                    instancePath: instancePath + "/previousSolution",
                    parentData: data,
                    parentDataProperty: "previousSolution",
                    rootData,
                    dynamicAnchors,
                  })
                ) {
                  vErrors =
                    vErrors === null
                      ? validate32.errors
                      : vErrors.concat(validate32.errors);
                  errors = vErrors.length;
                }
                var _valid0 = _errs8 === errors;
                valid1 = valid1 || _valid0;
                const _errs9 = errors;
                if (data2 !== null) {
                  const err0 = {
                    instancePath: instancePath + "/previousSolution",
                    schemaPath: "#/properties/previousSolution/anyOf/1/type",
                    keyword: "type",
                    params: { type: "null" },
                    message: "must be null",
                  };
                  if (vErrors === null) {
                    vErrors = [err0];
                  } else {
                    vErrors.push(err0);
                  }
                  errors++;
                }
                var _valid0 = _errs9 === errors;
                valid1 = valid1 || _valid0;
                if (!valid1) {
                  const err1 = {
                    instancePath: instancePath + "/previousSolution",
                    schemaPath: "#/properties/previousSolution/anyOf",
                    keyword: "anyOf",
                    params: {},
                    message: "must match a schema in anyOf",
                  };
                  if (vErrors === null) {
                    vErrors = [err1];
                  } else {
                    vErrors.push(err1);
                  }
                  errors++;
                  validate31.errors = vErrors;
                  return false;
                } else {
                  errors = _errs7;
                  if (vErrors !== null) {
                    if (_errs7) {
                      vErrors.length = _errs7;
                    } else {
                      vErrors = null;
                    }
                  }
                }
                var valid0 = _errs6 === errors;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.nextSolution !== undefined) {
                  let data3 = data.nextSolution;
                  const _errs11 = errors;
                  const _errs12 = errors;
                  let valid2 = false;
                  const _errs13 = errors;
                  if (
                    !validate32(data3, {
                      instancePath: instancePath + "/nextSolution",
                      parentData: data,
                      parentDataProperty: "nextSolution",
                      rootData,
                      dynamicAnchors,
                    })
                  ) {
                    vErrors =
                      vErrors === null
                        ? validate32.errors
                        : vErrors.concat(validate32.errors);
                    errors = vErrors.length;
                  }
                  var _valid1 = _errs13 === errors;
                  valid2 = valid2 || _valid1;
                  const _errs14 = errors;
                  if (data3 !== null) {
                    const err2 = {
                      instancePath: instancePath + "/nextSolution",
                      schemaPath: "#/properties/nextSolution/anyOf/1/type",
                      keyword: "type",
                      params: { type: "null" },
                      message: "must be null",
                    };
                    if (vErrors === null) {
                      vErrors = [err2];
                    } else {
                      vErrors.push(err2);
                    }
                    errors++;
                  }
                  var _valid1 = _errs14 === errors;
                  valid2 = valid2 || _valid1;
                  if (!valid2) {
                    const err3 = {
                      instancePath: instancePath + "/nextSolution",
                      schemaPath: "#/properties/nextSolution/anyOf",
                      keyword: "anyOf",
                      params: {},
                      message: "must match a schema in anyOf",
                    };
                    if (vErrors === null) {
                      vErrors = [err3];
                    } else {
                      vErrors.push(err3);
                    }
                    errors++;
                    validate31.errors = vErrors;
                    return false;
                  } else {
                    errors = _errs12;
                    if (vErrors !== null) {
                      if (_errs12) {
                        vErrors.length = _errs12;
                      } else {
                        vErrors = null;
                      }
                    }
                  }
                  var valid0 = _errs11 === errors;
                } else {
                  var valid0 = true;
                }
                if (valid0) {
                  if (data.witness !== undefined) {
                    let data4 = data.witness;
                    const _errs16 = errors;
                    const _errs17 = errors;
                    let valid3 = false;
                    const _errs18 = errors;
                    if (
                      !validate35(data4, {
                        instancePath: instancePath + "/witness",
                        parentData: data,
                        parentDataProperty: "witness",
                        rootData,
                        dynamicAnchors,
                      })
                    ) {
                      vErrors =
                        vErrors === null
                          ? validate35.errors
                          : vErrors.concat(validate35.errors);
                      errors = vErrors.length;
                    }
                    var _valid2 = _errs18 === errors;
                    valid3 = valid3 || _valid2;
                    const _errs19 = errors;
                    if (data4 !== null) {
                      const err4 = {
                        instancePath: instancePath + "/witness",
                        schemaPath: "#/properties/witness/anyOf/1/type",
                        keyword: "type",
                        params: { type: "null" },
                        message: "must be null",
                      };
                      if (vErrors === null) {
                        vErrors = [err4];
                      } else {
                        vErrors.push(err4);
                      }
                      errors++;
                    }
                    var _valid2 = _errs19 === errors;
                    valid3 = valid3 || _valid2;
                    if (!valid3) {
                      const err5 = {
                        instancePath: instancePath + "/witness",
                        schemaPath: "#/properties/witness/anyOf",
                        keyword: "anyOf",
                        params: {},
                        message: "must match a schema in anyOf",
                      };
                      if (vErrors === null) {
                        vErrors = [err5];
                      } else {
                        vErrors.push(err5);
                      }
                      errors++;
                      validate31.errors = vErrors;
                      return false;
                    } else {
                      errors = _errs17;
                      if (vErrors !== null) {
                        if (_errs17) {
                          vErrors.length = _errs17;
                        } else {
                          vErrors = null;
                        }
                      }
                    }
                    var valid0 = _errs16 === errors;
                  } else {
                    var valid0 = true;
                  }
                  if (valid0) {
                    if (data.summaryAr !== undefined) {
                      let data5 = data.summaryAr;
                      const _errs21 = errors;
                      const _errs22 = errors;
                      let valid4 = false;
                      const _errs23 = errors;
                      if (typeof data5 !== "string") {
                        const err6 = {
                          instancePath: instancePath + "/summaryAr",
                          schemaPath: "#/properties/summaryAr/anyOf/0/type",
                          keyword: "type",
                          params: { type: "string" },
                          message: "must be string",
                        };
                        if (vErrors === null) {
                          vErrors = [err6];
                        } else {
                          vErrors.push(err6);
                        }
                        errors++;
                      }
                      var _valid3 = _errs23 === errors;
                      valid4 = valid4 || _valid3;
                      const _errs25 = errors;
                      if (data5 !== null) {
                        const err7 = {
                          instancePath: instancePath + "/summaryAr",
                          schemaPath: "#/properties/summaryAr/anyOf/1/type",
                          keyword: "type",
                          params: { type: "null" },
                          message: "must be null",
                        };
                        if (vErrors === null) {
                          vErrors = [err7];
                        } else {
                          vErrors.push(err7);
                        }
                        errors++;
                      }
                      var _valid3 = _errs25 === errors;
                      valid4 = valid4 || _valid3;
                      if (!valid4) {
                        const err8 = {
                          instancePath: instancePath + "/summaryAr",
                          schemaPath: "#/properties/summaryAr/anyOf",
                          keyword: "anyOf",
                          params: {},
                          message: "must match a schema in anyOf",
                        };
                        if (vErrors === null) {
                          vErrors = [err8];
                        } else {
                          vErrors.push(err8);
                        }
                        errors++;
                        validate31.errors = vErrors;
                        return false;
                      } else {
                        errors = _errs22;
                        if (vErrors !== null) {
                          if (_errs22) {
                            vErrors.length = _errs22;
                          } else {
                            vErrors = null;
                          }
                        }
                      }
                      var valid0 = _errs21 === errors;
                    } else {
                      var valid0 = true;
                    }
                  }
                }
              }
            }
          }
        }
      }
    } else {
      validate31.errors = [
        {
          instancePath,
          schemaPath: "#/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        },
      ];
      return false;
    }
  }
  validate31.errors = vErrors;
  return errors === 0;
}
validate31.evaluated = {
  props: true,
  dynamicProps: false,
  dynamicItems: false,
};
function validate30(
  data,
  {
    instancePath = "",
    parentData,
    parentDataProperty,
    rootData = data,
    dynamicAnchors = {},
  } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate30.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (errors === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (
        (data.verificationResultId === undefined &&
          (missing0 = "verificationResultId")) ||
        (data.from === undefined && (missing0 = "from")) ||
        (data.to === undefined && (missing0 = "to")) ||
        (data.mathStatus === undefined && (missing0 = "mathStatus")) ||
        (data.reasonCode === undefined && (missing0 = "reasonCode")) ||
        (data.issue === undefined && (missing0 = "issue")) ||
        (data.evidence === undefined && (missing0 = "evidence")) ||
        (data.engineVersion === undefined && (missing0 = "engineVersion")) ||
        (data.notationProfileVersion === undefined &&
          (missing0 = "notationProfileVersion"))
      ) {
        validate30.errors = [
          {
            instancePath,
            schemaPath: "#/required",
            keyword: "required",
            params: { missingProperty: missing0 },
            message: "must have required property '" + missing0 + "'",
          },
        ];
        return false;
      } else {
        const _errs1 = errors;
        for (const key0 in data) {
          if (!func1.call(schema45.properties, key0)) {
            validate30.errors = [
              {
                instancePath,
                schemaPath: "#/additionalProperties",
                keyword: "additionalProperties",
                params: { additionalProperty: key0 },
                message: "must NOT have additional properties",
              },
            ];
            return false;
            break;
          }
        }
        if (_errs1 === errors) {
          if (data.verificationResultId !== undefined) {
            let data0 = data.verificationResultId;
            const _errs2 = errors;
            if (errors === _errs2) {
              if (errors === _errs2) {
                if (typeof data0 === "string") {
                  if (!formats4.test(data0)) {
                    validate30.errors = [
                      {
                        instancePath: instancePath + "/verificationResultId",
                        schemaPath: "#/properties/verificationResultId/format",
                        keyword: "format",
                        params: { format: "uuid" },
                        message: 'must match format "' + "uuid" + '"',
                      },
                    ];
                    return false;
                  }
                } else {
                  validate30.errors = [
                    {
                      instancePath: instancePath + "/verificationResultId",
                      schemaPath: "#/properties/verificationResultId/type",
                      keyword: "type",
                      params: { type: "string" },
                      message: "must be string",
                    },
                  ];
                  return false;
                }
              }
            }
            var valid0 = _errs2 === errors;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.from !== undefined) {
              let data1 = data.from;
              const _errs4 = errors;
              if (errors === _errs4) {
                if (
                  data1 &&
                  typeof data1 == "object" &&
                  !Array.isArray(data1)
                ) {
                  let missing1;
                  if (
                    (data1.kind === undefined && (missing1 = "kind")) ||
                    (data1.stepId === undefined && (missing1 = "stepId")) ||
                    (data1.stepVersion === undefined &&
                      (missing1 = "stepVersion"))
                  ) {
                    validate30.errors = [
                      {
                        instancePath: instancePath + "/from",
                        schemaPath: "#/properties/from/required",
                        keyword: "required",
                        params: { missingProperty: missing1 },
                        message:
                          "must have required property '" + missing1 + "'",
                      },
                    ];
                    return false;
                  } else {
                    const _errs6 = errors;
                    for (const key1 in data1) {
                      if (
                        !(
                          key1 === "kind" ||
                          key1 === "stepId" ||
                          key1 === "stepVersion"
                        )
                      ) {
                        validate30.errors = [
                          {
                            instancePath: instancePath + "/from",
                            schemaPath:
                              "#/properties/from/additionalProperties",
                            keyword: "additionalProperties",
                            params: { additionalProperty: key1 },
                            message: "must NOT have additional properties",
                          },
                        ];
                        return false;
                        break;
                      }
                    }
                    if (_errs6 === errors) {
                      if (data1.kind !== undefined) {
                        let data2 = data1.kind;
                        const _errs7 = errors;
                        if (typeof data2 !== "string") {
                          validate30.errors = [
                            {
                              instancePath: instancePath + "/from/kind",
                              schemaPath:
                                "#/properties/from/properties/kind/type",
                              keyword: "type",
                              params: { type: "string" },
                              message: "must be string",
                            },
                          ];
                          return false;
                        }
                        if (!(data2 === "problem" || data2 === "step")) {
                          validate30.errors = [
                            {
                              instancePath: instancePath + "/from/kind",
                              schemaPath:
                                "#/properties/from/properties/kind/enum",
                              keyword: "enum",
                              params: {
                                allowedValues:
                                  schema45.properties.from.properties.kind.enum,
                              },
                              message:
                                "must be equal to one of the allowed values",
                            },
                          ];
                          return false;
                        }
                        var valid1 = _errs7 === errors;
                      } else {
                        var valid1 = true;
                      }
                      if (valid1) {
                        if (data1.stepId !== undefined) {
                          let data3 = data1.stepId;
                          const _errs9 = errors;
                          const _errs10 = errors;
                          let valid2 = false;
                          const _errs11 = errors;
                          if (errors === _errs11) {
                            if (errors === _errs11) {
                              if (typeof data3 === "string") {
                                if (!formats4.test(data3)) {
                                  const err0 = {
                                    instancePath: instancePath + "/from/stepId",
                                    schemaPath:
                                      "#/properties/from/properties/stepId/anyOf/0/format",
                                    keyword: "format",
                                    params: { format: "uuid" },
                                    message:
                                      'must match format "' + "uuid" + '"',
                                  };
                                  if (vErrors === null) {
                                    vErrors = [err0];
                                  } else {
                                    vErrors.push(err0);
                                  }
                                  errors++;
                                }
                              } else {
                                const err1 = {
                                  instancePath: instancePath + "/from/stepId",
                                  schemaPath:
                                    "#/properties/from/properties/stepId/anyOf/0/type",
                                  keyword: "type",
                                  params: { type: "string" },
                                  message: "must be string",
                                };
                                if (vErrors === null) {
                                  vErrors = [err1];
                                } else {
                                  vErrors.push(err1);
                                }
                                errors++;
                              }
                            }
                          }
                          var _valid0 = _errs11 === errors;
                          valid2 = valid2 || _valid0;
                          const _errs13 = errors;
                          if (data3 !== null) {
                            const err2 = {
                              instancePath: instancePath + "/from/stepId",
                              schemaPath:
                                "#/properties/from/properties/stepId/anyOf/1/type",
                              keyword: "type",
                              params: { type: "null" },
                              message: "must be null",
                            };
                            if (vErrors === null) {
                              vErrors = [err2];
                            } else {
                              vErrors.push(err2);
                            }
                            errors++;
                          }
                          var _valid0 = _errs13 === errors;
                          valid2 = valid2 || _valid0;
                          if (!valid2) {
                            const err3 = {
                              instancePath: instancePath + "/from/stepId",
                              schemaPath:
                                "#/properties/from/properties/stepId/anyOf",
                              keyword: "anyOf",
                              params: {},
                              message: "must match a schema in anyOf",
                            };
                            if (vErrors === null) {
                              vErrors = [err3];
                            } else {
                              vErrors.push(err3);
                            }
                            errors++;
                            validate30.errors = vErrors;
                            return false;
                          } else {
                            errors = _errs10;
                            if (vErrors !== null) {
                              if (_errs10) {
                                vErrors.length = _errs10;
                              } else {
                                vErrors = null;
                              }
                            }
                          }
                          var valid1 = _errs9 === errors;
                        } else {
                          var valid1 = true;
                        }
                        if (valid1) {
                          if (data1.stepVersion !== undefined) {
                            let data4 = data1.stepVersion;
                            const _errs15 = errors;
                            const _errs16 = errors;
                            let valid3 = false;
                            const _errs17 = errors;
                            if (
                              !(
                                typeof data4 == "number" &&
                                !(data4 % 1) &&
                                !isNaN(data4)
                              )
                            ) {
                              const err4 = {
                                instancePath:
                                  instancePath + "/from/stepVersion",
                                schemaPath:
                                  "#/properties/from/properties/stepVersion/anyOf/0/type",
                                keyword: "type",
                                params: { type: "integer" },
                                message: "must be integer",
                              };
                              if (vErrors === null) {
                                vErrors = [err4];
                              } else {
                                vErrors.push(err4);
                              }
                              errors++;
                            }
                            if (errors === _errs17) {
                              if (typeof data4 == "number") {
                                if (data4 < 1 || isNaN(data4)) {
                                  const err5 = {
                                    instancePath:
                                      instancePath + "/from/stepVersion",
                                    schemaPath:
                                      "#/properties/from/properties/stepVersion/anyOf/0/minimum",
                                    keyword: "minimum",
                                    params: { comparison: ">=", limit: 1 },
                                    message: "must be >= 1",
                                  };
                                  if (vErrors === null) {
                                    vErrors = [err5];
                                  } else {
                                    vErrors.push(err5);
                                  }
                                  errors++;
                                } else {
                                  if (!formats0.validate(data4)) {
                                    const err6 = {
                                      instancePath:
                                        instancePath + "/from/stepVersion",
                                      schemaPath:
                                        "#/properties/from/properties/stepVersion/anyOf/0/format",
                                      keyword: "format",
                                      params: { format: "int32" },
                                      message:
                                        'must match format "' + "int32" + '"',
                                    };
                                    if (vErrors === null) {
                                      vErrors = [err6];
                                    } else {
                                      vErrors.push(err6);
                                    }
                                    errors++;
                                  }
                                }
                              }
                            }
                            var _valid1 = _errs17 === errors;
                            valid3 = valid3 || _valid1;
                            const _errs19 = errors;
                            if (data4 !== null) {
                              const err7 = {
                                instancePath:
                                  instancePath + "/from/stepVersion",
                                schemaPath:
                                  "#/properties/from/properties/stepVersion/anyOf/1/type",
                                keyword: "type",
                                params: { type: "null" },
                                message: "must be null",
                              };
                              if (vErrors === null) {
                                vErrors = [err7];
                              } else {
                                vErrors.push(err7);
                              }
                              errors++;
                            }
                            var _valid1 = _errs19 === errors;
                            valid3 = valid3 || _valid1;
                            if (!valid3) {
                              const err8 = {
                                instancePath:
                                  instancePath + "/from/stepVersion",
                                schemaPath:
                                  "#/properties/from/properties/stepVersion/anyOf",
                                keyword: "anyOf",
                                params: {},
                                message: "must match a schema in anyOf",
                              };
                              if (vErrors === null) {
                                vErrors = [err8];
                              } else {
                                vErrors.push(err8);
                              }
                              errors++;
                              validate30.errors = vErrors;
                              return false;
                            } else {
                              errors = _errs16;
                              if (vErrors !== null) {
                                if (_errs16) {
                                  vErrors.length = _errs16;
                                } else {
                                  vErrors = null;
                                }
                              }
                            }
                            var valid1 = _errs15 === errors;
                          } else {
                            var valid1 = true;
                          }
                        }
                      }
                    }
                  }
                } else {
                  validate30.errors = [
                    {
                      instancePath: instancePath + "/from",
                      schemaPath: "#/properties/from/type",
                      keyword: "type",
                      params: { type: "object" },
                      message: "must be object",
                    },
                  ];
                  return false;
                }
              }
              var valid0 = _errs4 === errors;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.to !== undefined) {
                let data5 = data.to;
                const _errs21 = errors;
                if (errors === _errs21) {
                  if (
                    data5 &&
                    typeof data5 == "object" &&
                    !Array.isArray(data5)
                  ) {
                    let missing2;
                    if (
                      (data5.stepId === undefined && (missing2 = "stepId")) ||
                      (data5.stepVersion === undefined &&
                        (missing2 = "stepVersion"))
                    ) {
                      validate30.errors = [
                        {
                          instancePath: instancePath + "/to",
                          schemaPath: "#/properties/to/required",
                          keyword: "required",
                          params: { missingProperty: missing2 },
                          message:
                            "must have required property '" + missing2 + "'",
                        },
                      ];
                      return false;
                    } else {
                      const _errs23 = errors;
                      for (const key2 in data5) {
                        if (!(key2 === "stepId" || key2 === "stepVersion")) {
                          validate30.errors = [
                            {
                              instancePath: instancePath + "/to",
                              schemaPath:
                                "#/properties/to/additionalProperties",
                              keyword: "additionalProperties",
                              params: { additionalProperty: key2 },
                              message: "must NOT have additional properties",
                            },
                          ];
                          return false;
                          break;
                        }
                      }
                      if (_errs23 === errors) {
                        if (data5.stepId !== undefined) {
                          let data6 = data5.stepId;
                          const _errs24 = errors;
                          if (errors === _errs24) {
                            if (errors === _errs24) {
                              if (typeof data6 === "string") {
                                if (!formats4.test(data6)) {
                                  validate30.errors = [
                                    {
                                      instancePath: instancePath + "/to/stepId",
                                      schemaPath:
                                        "#/properties/to/properties/stepId/format",
                                      keyword: "format",
                                      params: { format: "uuid" },
                                      message:
                                        'must match format "' + "uuid" + '"',
                                    },
                                  ];
                                  return false;
                                }
                              } else {
                                validate30.errors = [
                                  {
                                    instancePath: instancePath + "/to/stepId",
                                    schemaPath:
                                      "#/properties/to/properties/stepId/type",
                                    keyword: "type",
                                    params: { type: "string" },
                                    message: "must be string",
                                  },
                                ];
                                return false;
                              }
                            }
                          }
                          var valid4 = _errs24 === errors;
                        } else {
                          var valid4 = true;
                        }
                        if (valid4) {
                          if (data5.stepVersion !== undefined) {
                            let data7 = data5.stepVersion;
                            const _errs26 = errors;
                            if (
                              !(
                                typeof data7 == "number" &&
                                !(data7 % 1) &&
                                !isNaN(data7)
                              )
                            ) {
                              validate30.errors = [
                                {
                                  instancePath:
                                    instancePath + "/to/stepVersion",
                                  schemaPath:
                                    "#/properties/to/properties/stepVersion/type",
                                  keyword: "type",
                                  params: { type: "integer" },
                                  message: "must be integer",
                                },
                              ];
                              return false;
                            }
                            if (errors === _errs26) {
                              if (typeof data7 == "number") {
                                if (data7 < 1 || isNaN(data7)) {
                                  validate30.errors = [
                                    {
                                      instancePath:
                                        instancePath + "/to/stepVersion",
                                      schemaPath:
                                        "#/properties/to/properties/stepVersion/minimum",
                                      keyword: "minimum",
                                      params: { comparison: ">=", limit: 1 },
                                      message: "must be >= 1",
                                    },
                                  ];
                                  return false;
                                } else {
                                  if (!formats0.validate(data7)) {
                                    validate30.errors = [
                                      {
                                        instancePath:
                                          instancePath + "/to/stepVersion",
                                        schemaPath:
                                          "#/properties/to/properties/stepVersion/format",
                                        keyword: "format",
                                        params: { format: "int32" },
                                        message:
                                          'must match format "' + "int32" + '"',
                                      },
                                    ];
                                    return false;
                                  }
                                }
                              }
                            }
                            var valid4 = _errs26 === errors;
                          } else {
                            var valid4 = true;
                          }
                        }
                      }
                    }
                  } else {
                    validate30.errors = [
                      {
                        instancePath: instancePath + "/to",
                        schemaPath: "#/properties/to/type",
                        keyword: "type",
                        params: { type: "object" },
                        message: "must be object",
                      },
                    ];
                    return false;
                  }
                }
                var valid0 = _errs21 === errors;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.mathStatus !== undefined) {
                  let data8 = data.mathStatus;
                  const _errs28 = errors;
                  if (typeof data8 !== "string") {
                    validate30.errors = [
                      {
                        instancePath: instancePath + "/mathStatus",
                        schemaPath: "#/components/schemas/MathStatus/type",
                        keyword: "type",
                        params: { type: "string" },
                        message: "must be string",
                      },
                    ];
                    return false;
                  }
                  if (
                    !(
                      data8 === "verified_valid" ||
                      data8 === "verified_invalid" ||
                      data8 === "syntax_error" ||
                      data8 === "unsupported" ||
                      data8 === "inconclusive" ||
                      data8 === "service_error"
                    )
                  ) {
                    validate30.errors = [
                      {
                        instancePath: instancePath + "/mathStatus",
                        schemaPath: "#/components/schemas/MathStatus/enum",
                        keyword: "enum",
                        params: { allowedValues: schema46.enum },
                        message: "must be equal to one of the allowed values",
                      },
                    ];
                    return false;
                  }
                  var valid0 = _errs28 === errors;
                } else {
                  var valid0 = true;
                }
                if (valid0) {
                  if (data.reasonCode !== undefined) {
                    let data9 = data.reasonCode;
                    const _errs31 = errors;
                    const _errs32 = errors;
                    let valid6 = false;
                    const _errs33 = errors;
                    if (typeof data9 !== "string") {
                      const err9 = {
                        instancePath: instancePath + "/reasonCode",
                        schemaPath: "#/properties/reasonCode/anyOf/0/type",
                        keyword: "type",
                        params: { type: "string" },
                        message: "must be string",
                      };
                      if (vErrors === null) {
                        vErrors = [err9];
                      } else {
                        vErrors.push(err9);
                      }
                      errors++;
                    }
                    var _valid2 = _errs33 === errors;
                    valid6 = valid6 || _valid2;
                    const _errs35 = errors;
                    if (data9 !== null) {
                      const err10 = {
                        instancePath: instancePath + "/reasonCode",
                        schemaPath: "#/properties/reasonCode/anyOf/1/type",
                        keyword: "type",
                        params: { type: "null" },
                        message: "must be null",
                      };
                      if (vErrors === null) {
                        vErrors = [err10];
                      } else {
                        vErrors.push(err10);
                      }
                      errors++;
                    }
                    var _valid2 = _errs35 === errors;
                    valid6 = valid6 || _valid2;
                    if (!valid6) {
                      const err11 = {
                        instancePath: instancePath + "/reasonCode",
                        schemaPath: "#/properties/reasonCode/anyOf",
                        keyword: "anyOf",
                        params: {},
                        message: "must match a schema in anyOf",
                      };
                      if (vErrors === null) {
                        vErrors = [err11];
                      } else {
                        vErrors.push(err11);
                      }
                      errors++;
                      validate30.errors = vErrors;
                      return false;
                    } else {
                      errors = _errs32;
                      if (vErrors !== null) {
                        if (_errs32) {
                          vErrors.length = _errs32;
                        } else {
                          vErrors = null;
                        }
                      }
                    }
                    var valid0 = _errs31 === errors;
                  } else {
                    var valid0 = true;
                  }
                  if (valid0) {
                    if (data.issue !== undefined) {
                      let data10 = data.issue;
                      const _errs37 = errors;
                      const _errs38 = errors;
                      let valid7 = false;
                      const _errs39 = errors;
                      const _errs40 = errors;
                      if (errors === _errs40) {
                        if (
                          data10 &&
                          typeof data10 == "object" &&
                          !Array.isArray(data10)
                        ) {
                          let missing3;
                          if (
                            (data10.reasonCode === undefined &&
                              (missing3 = "reasonCode")) ||
                            (data10.messageAr === undefined &&
                              (missing3 = "messageAr")) ||
                            (data10.spanStart === undefined &&
                              (missing3 = "spanStart")) ||
                            (data10.spanEnd === undefined &&
                              (missing3 = "spanEnd")) ||
                            (data10.spanUnit === undefined &&
                              (missing3 = "spanUnit")) ||
                            (data10.hintKey === undefined &&
                              (missing3 = "hintKey"))
                          ) {
                            const err12 = {
                              instancePath: instancePath + "/issue",
                              schemaPath:
                                "#/components/schemas/MathIssue/required",
                              keyword: "required",
                              params: { missingProperty: missing3 },
                              message:
                                "must have required property '" +
                                missing3 +
                                "'",
                            };
                            if (vErrors === null) {
                              vErrors = [err12];
                            } else {
                              vErrors.push(err12);
                            }
                            errors++;
                          } else {
                            const _errs42 = errors;
                            for (const key3 in data10) {
                              if (
                                !(
                                  key3 === "reasonCode" ||
                                  key3 === "messageAr" ||
                                  key3 === "spanStart" ||
                                  key3 === "spanEnd" ||
                                  key3 === "spanUnit" ||
                                  key3 === "hintKey"
                                )
                              ) {
                                const err13 = {
                                  instancePath: instancePath + "/issue",
                                  schemaPath:
                                    "#/components/schemas/MathIssue/additionalProperties",
                                  keyword: "additionalProperties",
                                  params: { additionalProperty: key3 },
                                  message:
                                    "must NOT have additional properties",
                                };
                                if (vErrors === null) {
                                  vErrors = [err13];
                                } else {
                                  vErrors.push(err13);
                                }
                                errors++;
                                break;
                              }
                            }
                            if (_errs42 === errors) {
                              if (data10.reasonCode !== undefined) {
                                let data11 = data10.reasonCode;
                                const _errs43 = errors;
                                if (errors === _errs43) {
                                  if (typeof data11 === "string") {
                                    if (func2(data11) > 80) {
                                      const err14 = {
                                        instancePath:
                                          instancePath + "/issue/reasonCode",
                                        schemaPath:
                                          "#/components/schemas/MathIssue/properties/reasonCode/maxLength",
                                        keyword: "maxLength",
                                        params: { limit: 80 },
                                        message:
                                          "must NOT have more than 80 characters",
                                      };
                                      if (vErrors === null) {
                                        vErrors = [err14];
                                      } else {
                                        vErrors.push(err14);
                                      }
                                      errors++;
                                    }
                                  } else {
                                    const err15 = {
                                      instancePath:
                                        instancePath + "/issue/reasonCode",
                                      schemaPath:
                                        "#/components/schemas/MathIssue/properties/reasonCode/type",
                                      keyword: "type",
                                      params: { type: "string" },
                                      message: "must be string",
                                    };
                                    if (vErrors === null) {
                                      vErrors = [err15];
                                    } else {
                                      vErrors.push(err15);
                                    }
                                    errors++;
                                  }
                                }
                                var valid9 = _errs43 === errors;
                              } else {
                                var valid9 = true;
                              }
                              if (valid9) {
                                if (data10.messageAr !== undefined) {
                                  const _errs45 = errors;
                                  if (typeof data10.messageAr !== "string") {
                                    const err16 = {
                                      instancePath:
                                        instancePath + "/issue/messageAr",
                                      schemaPath:
                                        "#/components/schemas/MathIssue/properties/messageAr/type",
                                      keyword: "type",
                                      params: { type: "string" },
                                      message: "must be string",
                                    };
                                    if (vErrors === null) {
                                      vErrors = [err16];
                                    } else {
                                      vErrors.push(err16);
                                    }
                                    errors++;
                                  }
                                  var valid9 = _errs45 === errors;
                                } else {
                                  var valid9 = true;
                                }
                                if (valid9) {
                                  if (data10.spanStart !== undefined) {
                                    let data13 = data10.spanStart;
                                    const _errs47 = errors;
                                    const _errs48 = errors;
                                    let valid10 = false;
                                    const _errs49 = errors;
                                    if (
                                      !(
                                        typeof data13 == "number" &&
                                        !(data13 % 1) &&
                                        !isNaN(data13)
                                      )
                                    ) {
                                      const err17 = {
                                        instancePath:
                                          instancePath + "/issue/spanStart",
                                        schemaPath:
                                          "#/components/schemas/MathIssue/properties/spanStart/anyOf/0/type",
                                        keyword: "type",
                                        params: { type: "integer" },
                                        message: "must be integer",
                                      };
                                      if (vErrors === null) {
                                        vErrors = [err17];
                                      } else {
                                        vErrors.push(err17);
                                      }
                                      errors++;
                                    }
                                    if (errors === _errs49) {
                                      if (typeof data13 == "number") {
                                        if (data13 < 0 || isNaN(data13)) {
                                          const err18 = {
                                            instancePath:
                                              instancePath + "/issue/spanStart",
                                            schemaPath:
                                              "#/components/schemas/MathIssue/properties/spanStart/anyOf/0/minimum",
                                            keyword: "minimum",
                                            params: {
                                              comparison: ">=",
                                              limit: 0,
                                            },
                                            message: "must be >= 0",
                                          };
                                          if (vErrors === null) {
                                            vErrors = [err18];
                                          } else {
                                            vErrors.push(err18);
                                          }
                                          errors++;
                                        } else {
                                          if (!formats0.validate(data13)) {
                                            const err19 = {
                                              instancePath:
                                                instancePath +
                                                "/issue/spanStart",
                                              schemaPath:
                                                "#/components/schemas/MathIssue/properties/spanStart/anyOf/0/format",
                                              keyword: "format",
                                              params: { format: "int32" },
                                              message:
                                                'must match format "' +
                                                "int32" +
                                                '"',
                                            };
                                            if (vErrors === null) {
                                              vErrors = [err19];
                                            } else {
                                              vErrors.push(err19);
                                            }
                                            errors++;
                                          }
                                        }
                                      }
                                    }
                                    var _valid4 = _errs49 === errors;
                                    valid10 = valid10 || _valid4;
                                    const _errs51 = errors;
                                    if (data13 !== null) {
                                      const err20 = {
                                        instancePath:
                                          instancePath + "/issue/spanStart",
                                        schemaPath:
                                          "#/components/schemas/MathIssue/properties/spanStart/anyOf/1/type",
                                        keyword: "type",
                                        params: { type: "null" },
                                        message: "must be null",
                                      };
                                      if (vErrors === null) {
                                        vErrors = [err20];
                                      } else {
                                        vErrors.push(err20);
                                      }
                                      errors++;
                                    }
                                    var _valid4 = _errs51 === errors;
                                    valid10 = valid10 || _valid4;
                                    if (!valid10) {
                                      const err21 = {
                                        instancePath:
                                          instancePath + "/issue/spanStart",
                                        schemaPath:
                                          "#/components/schemas/MathIssue/properties/spanStart/anyOf",
                                        keyword: "anyOf",
                                        params: {},
                                        message: "must match a schema in anyOf",
                                      };
                                      if (vErrors === null) {
                                        vErrors = [err21];
                                      } else {
                                        vErrors.push(err21);
                                      }
                                      errors++;
                                    } else {
                                      errors = _errs48;
                                      if (vErrors !== null) {
                                        if (_errs48) {
                                          vErrors.length = _errs48;
                                        } else {
                                          vErrors = null;
                                        }
                                      }
                                    }
                                    var valid9 = _errs47 === errors;
                                  } else {
                                    var valid9 = true;
                                  }
                                  if (valid9) {
                                    if (data10.spanEnd !== undefined) {
                                      let data14 = data10.spanEnd;
                                      const _errs53 = errors;
                                      const _errs54 = errors;
                                      let valid11 = false;
                                      const _errs55 = errors;
                                      if (
                                        !(
                                          typeof data14 == "number" &&
                                          !(data14 % 1) &&
                                          !isNaN(data14)
                                        )
                                      ) {
                                        const err22 = {
                                          instancePath:
                                            instancePath + "/issue/spanEnd",
                                          schemaPath:
                                            "#/components/schemas/MathIssue/properties/spanEnd/anyOf/0/type",
                                          keyword: "type",
                                          params: { type: "integer" },
                                          message: "must be integer",
                                        };
                                        if (vErrors === null) {
                                          vErrors = [err22];
                                        } else {
                                          vErrors.push(err22);
                                        }
                                        errors++;
                                      }
                                      if (errors === _errs55) {
                                        if (typeof data14 == "number") {
                                          if (data14 < 0 || isNaN(data14)) {
                                            const err23 = {
                                              instancePath:
                                                instancePath + "/issue/spanEnd",
                                              schemaPath:
                                                "#/components/schemas/MathIssue/properties/spanEnd/anyOf/0/minimum",
                                              keyword: "minimum",
                                              params: {
                                                comparison: ">=",
                                                limit: 0,
                                              },
                                              message: "must be >= 0",
                                            };
                                            if (vErrors === null) {
                                              vErrors = [err23];
                                            } else {
                                              vErrors.push(err23);
                                            }
                                            errors++;
                                          } else {
                                            if (!formats0.validate(data14)) {
                                              const err24 = {
                                                instancePath:
                                                  instancePath +
                                                  "/issue/spanEnd",
                                                schemaPath:
                                                  "#/components/schemas/MathIssue/properties/spanEnd/anyOf/0/format",
                                                keyword: "format",
                                                params: { format: "int32" },
                                                message:
                                                  'must match format "' +
                                                  "int32" +
                                                  '"',
                                              };
                                              if (vErrors === null) {
                                                vErrors = [err24];
                                              } else {
                                                vErrors.push(err24);
                                              }
                                              errors++;
                                            }
                                          }
                                        }
                                      }
                                      var _valid5 = _errs55 === errors;
                                      valid11 = valid11 || _valid5;
                                      const _errs57 = errors;
                                      if (data14 !== null) {
                                        const err25 = {
                                          instancePath:
                                            instancePath + "/issue/spanEnd",
                                          schemaPath:
                                            "#/components/schemas/MathIssue/properties/spanEnd/anyOf/1/type",
                                          keyword: "type",
                                          params: { type: "null" },
                                          message: "must be null",
                                        };
                                        if (vErrors === null) {
                                          vErrors = [err25];
                                        } else {
                                          vErrors.push(err25);
                                        }
                                        errors++;
                                      }
                                      var _valid5 = _errs57 === errors;
                                      valid11 = valid11 || _valid5;
                                      if (!valid11) {
                                        const err26 = {
                                          instancePath:
                                            instancePath + "/issue/spanEnd",
                                          schemaPath:
                                            "#/components/schemas/MathIssue/properties/spanEnd/anyOf",
                                          keyword: "anyOf",
                                          params: {},
                                          message:
                                            "must match a schema in anyOf",
                                        };
                                        if (vErrors === null) {
                                          vErrors = [err26];
                                        } else {
                                          vErrors.push(err26);
                                        }
                                        errors++;
                                      } else {
                                        errors = _errs54;
                                        if (vErrors !== null) {
                                          if (_errs54) {
                                            vErrors.length = _errs54;
                                          } else {
                                            vErrors = null;
                                          }
                                        }
                                      }
                                      var valid9 = _errs53 === errors;
                                    } else {
                                      var valid9 = true;
                                    }
                                    if (valid9) {
                                      if (data10.spanUnit !== undefined) {
                                        let data15 = data10.spanUnit;
                                        const _errs59 = errors;
                                        if (typeof data15 !== "string") {
                                          const err27 = {
                                            instancePath:
                                              instancePath + "/issue/spanUnit",
                                            schemaPath:
                                              "#/components/schemas/MathIssue/properties/spanUnit/type",
                                            keyword: "type",
                                            params: { type: "string" },
                                            message: "must be string",
                                          };
                                          if (vErrors === null) {
                                            vErrors = [err27];
                                          } else {
                                            vErrors.push(err27);
                                          }
                                          errors++;
                                        }
                                        if (!(data15 === "unicode_codepoint")) {
                                          const err28 = {
                                            instancePath:
                                              instancePath + "/issue/spanUnit",
                                            schemaPath:
                                              "#/components/schemas/MathIssue/properties/spanUnit/enum",
                                            keyword: "enum",
                                            params: {
                                              allowedValues:
                                                schema47.properties.spanUnit
                                                  .enum,
                                            },
                                            message:
                                              "must be equal to one of the allowed values",
                                          };
                                          if (vErrors === null) {
                                            vErrors = [err28];
                                          } else {
                                            vErrors.push(err28);
                                          }
                                          errors++;
                                        }
                                        var valid9 = _errs59 === errors;
                                      } else {
                                        var valid9 = true;
                                      }
                                      if (valid9) {
                                        if (data10.hintKey !== undefined) {
                                          let data16 = data10.hintKey;
                                          const _errs61 = errors;
                                          const _errs62 = errors;
                                          let valid12 = false;
                                          const _errs63 = errors;
                                          if (errors === _errs63) {
                                            if (typeof data16 === "string") {
                                              if (func2(data16) > 80) {
                                                const err29 = {
                                                  instancePath:
                                                    instancePath +
                                                    "/issue/hintKey",
                                                  schemaPath:
                                                    "#/components/schemas/MathIssue/properties/hintKey/anyOf/0/maxLength",
                                                  keyword: "maxLength",
                                                  params: { limit: 80 },
                                                  message:
                                                    "must NOT have more than 80 characters",
                                                };
                                                if (vErrors === null) {
                                                  vErrors = [err29];
                                                } else {
                                                  vErrors.push(err29);
                                                }
                                                errors++;
                                              }
                                            } else {
                                              const err30 = {
                                                instancePath:
                                                  instancePath +
                                                  "/issue/hintKey",
                                                schemaPath:
                                                  "#/components/schemas/MathIssue/properties/hintKey/anyOf/0/type",
                                                keyword: "type",
                                                params: { type: "string" },
                                                message: "must be string",
                                              };
                                              if (vErrors === null) {
                                                vErrors = [err30];
                                              } else {
                                                vErrors.push(err30);
                                              }
                                              errors++;
                                            }
                                          }
                                          var _valid6 = _errs63 === errors;
                                          valid12 = valid12 || _valid6;
                                          const _errs65 = errors;
                                          if (data16 !== null) {
                                            const err31 = {
                                              instancePath:
                                                instancePath + "/issue/hintKey",
                                              schemaPath:
                                                "#/components/schemas/MathIssue/properties/hintKey/anyOf/1/type",
                                              keyword: "type",
                                              params: { type: "null" },
                                              message: "must be null",
                                            };
                                            if (vErrors === null) {
                                              vErrors = [err31];
                                            } else {
                                              vErrors.push(err31);
                                            }
                                            errors++;
                                          }
                                          var _valid6 = _errs65 === errors;
                                          valid12 = valid12 || _valid6;
                                          if (!valid12) {
                                            const err32 = {
                                              instancePath:
                                                instancePath + "/issue/hintKey",
                                              schemaPath:
                                                "#/components/schemas/MathIssue/properties/hintKey/anyOf",
                                              keyword: "anyOf",
                                              params: {},
                                              message:
                                                "must match a schema in anyOf",
                                            };
                                            if (vErrors === null) {
                                              vErrors = [err32];
                                            } else {
                                              vErrors.push(err32);
                                            }
                                            errors++;
                                          } else {
                                            errors = _errs62;
                                            if (vErrors !== null) {
                                              if (_errs62) {
                                                vErrors.length = _errs62;
                                              } else {
                                                vErrors = null;
                                              }
                                            }
                                          }
                                          var valid9 = _errs61 === errors;
                                        } else {
                                          var valid9 = true;
                                        }
                                      }
                                    }
                                  }
                                }
                              }
                            }
                          }
                        } else {
                          const err33 = {
                            instancePath: instancePath + "/issue",
                            schemaPath: "#/components/schemas/MathIssue/type",
                            keyword: "type",
                            params: { type: "object" },
                            message: "must be object",
                          };
                          if (vErrors === null) {
                            vErrors = [err33];
                          } else {
                            vErrors.push(err33);
                          }
                          errors++;
                        }
                      }
                      var _valid3 = _errs39 === errors;
                      valid7 = valid7 || _valid3;
                      const _errs67 = errors;
                      if (data10 !== null) {
                        const err34 = {
                          instancePath: instancePath + "/issue",
                          schemaPath: "#/properties/issue/anyOf/1/type",
                          keyword: "type",
                          params: { type: "null" },
                          message: "must be null",
                        };
                        if (vErrors === null) {
                          vErrors = [err34];
                        } else {
                          vErrors.push(err34);
                        }
                        errors++;
                      }
                      var _valid3 = _errs67 === errors;
                      valid7 = valid7 || _valid3;
                      if (!valid7) {
                        const err35 = {
                          instancePath: instancePath + "/issue",
                          schemaPath: "#/properties/issue/anyOf",
                          keyword: "anyOf",
                          params: {},
                          message: "must match a schema in anyOf",
                        };
                        if (vErrors === null) {
                          vErrors = [err35];
                        } else {
                          vErrors.push(err35);
                        }
                        errors++;
                        validate30.errors = vErrors;
                        return false;
                      } else {
                        errors = _errs38;
                        if (vErrors !== null) {
                          if (_errs38) {
                            vErrors.length = _errs38;
                          } else {
                            vErrors = null;
                          }
                        }
                      }
                      var valid0 = _errs37 === errors;
                    } else {
                      var valid0 = true;
                    }
                    if (valid0) {
                      if (data.evidence !== undefined) {
                        let data17 = data.evidence;
                        const _errs69 = errors;
                        const _errs70 = errors;
                        let valid13 = false;
                        const _errs71 = errors;
                        if (
                          !validate31(data17, {
                            instancePath: instancePath + "/evidence",
                            parentData: data,
                            parentDataProperty: "evidence",
                            rootData,
                            dynamicAnchors,
                          })
                        ) {
                          vErrors =
                            vErrors === null
                              ? validate31.errors
                              : vErrors.concat(validate31.errors);
                          errors = vErrors.length;
                        }
                        var _valid7 = _errs71 === errors;
                        valid13 = valid13 || _valid7;
                        const _errs72 = errors;
                        if (data17 !== null) {
                          const err36 = {
                            instancePath: instancePath + "/evidence",
                            schemaPath: "#/properties/evidence/anyOf/1/type",
                            keyword: "type",
                            params: { type: "null" },
                            message: "must be null",
                          };
                          if (vErrors === null) {
                            vErrors = [err36];
                          } else {
                            vErrors.push(err36);
                          }
                          errors++;
                        }
                        var _valid7 = _errs72 === errors;
                        valid13 = valid13 || _valid7;
                        if (!valid13) {
                          const err37 = {
                            instancePath: instancePath + "/evidence",
                            schemaPath: "#/properties/evidence/anyOf",
                            keyword: "anyOf",
                            params: {},
                            message: "must match a schema in anyOf",
                          };
                          if (vErrors === null) {
                            vErrors = [err37];
                          } else {
                            vErrors.push(err37);
                          }
                          errors++;
                          validate30.errors = vErrors;
                          return false;
                        } else {
                          errors = _errs70;
                          if (vErrors !== null) {
                            if (_errs70) {
                              vErrors.length = _errs70;
                            } else {
                              vErrors = null;
                            }
                          }
                        }
                        var valid0 = _errs69 === errors;
                      } else {
                        var valid0 = true;
                      }
                      if (valid0) {
                        if (data.engineVersion !== undefined) {
                          const _errs74 = errors;
                          if (typeof data.engineVersion !== "string") {
                            validate30.errors = [
                              {
                                instancePath: instancePath + "/engineVersion",
                                schemaPath: "#/properties/engineVersion/type",
                                keyword: "type",
                                params: { type: "string" },
                                message: "must be string",
                              },
                            ];
                            return false;
                          }
                          var valid0 = _errs74 === errors;
                        } else {
                          var valid0 = true;
                        }
                        if (valid0) {
                          if (data.notationProfileVersion !== undefined) {
                            const _errs76 = errors;
                            if (
                              typeof data.notationProfileVersion !== "string"
                            ) {
                              validate30.errors = [
                                {
                                  instancePath:
                                    instancePath + "/notationProfileVersion",
                                  schemaPath:
                                    "#/properties/notationProfileVersion/type",
                                  keyword: "type",
                                  params: { type: "string" },
                                  message: "must be string",
                                },
                              ];
                              return false;
                            }
                            var valid0 = _errs76 === errors;
                          } else {
                            var valid0 = true;
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    } else {
      validate30.errors = [
        {
          instancePath,
          schemaPath: "#/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        },
      ];
      return false;
    }
  }
  validate30.errors = vErrors;
  return errors === 0;
}
validate30.evaluated = {
  props: true,
  dynamicProps: false,
  dynamicItems: false,
};
const schema54 = {
  type: "object",
  additionalProperties: false,
  properties: {
    diagnosisId: {
      anyOf: [{ type: "string", format: "uuid" }, { type: "null" }],
    },
    state: { $ref: "#/components/schemas/DiagnosisState" },
    errorCode: {
      anyOf: [
        {
          type: "string",
          description: "كود خطأ من ERR-ALG-01 إلى ERR-ALG-06.",
          pattern: "^ERR-ALG-0[1-6]$",
        },
        { type: "null" },
      ],
    },
    skillId: { anyOf: [{ type: "string", format: "uuid" }, { type: "null" }] },
    explanationAr: {
      type: "string",
      description: "صياغة احتمالية، لا حكم قطعي.",
    },
    needsProbe: { type: "boolean" },
  },
  required: [
    "diagnosisId",
    "state",
    "errorCode",
    "skillId",
    "explanationAr",
    "needsProbe",
  ],
};
const schema55 = {
  type: "string",
  description: "حالة فرضية الخطأ، وليست حكمًا على الطالب.",
  enum: [
    "tentative",
    "needs_probe",
    "supported_by_probe",
    "rejected",
    "unresolved",
  ],
};
const pattern8 = new RegExp("^ERR-ALG-0[1-6]$", "u");
function validate39(
  data,
  {
    instancePath = "",
    parentData,
    parentDataProperty,
    rootData = data,
    dynamicAnchors = {},
  } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate39.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (errors === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (
        (data.diagnosisId === undefined && (missing0 = "diagnosisId")) ||
        (data.state === undefined && (missing0 = "state")) ||
        (data.errorCode === undefined && (missing0 = "errorCode")) ||
        (data.skillId === undefined && (missing0 = "skillId")) ||
        (data.explanationAr === undefined && (missing0 = "explanationAr")) ||
        (data.needsProbe === undefined && (missing0 = "needsProbe"))
      ) {
        validate39.errors = [
          {
            instancePath,
            schemaPath: "#/required",
            keyword: "required",
            params: { missingProperty: missing0 },
            message: "must have required property '" + missing0 + "'",
          },
        ];
        return false;
      } else {
        const _errs1 = errors;
        for (const key0 in data) {
          if (
            !(
              key0 === "diagnosisId" ||
              key0 === "state" ||
              key0 === "errorCode" ||
              key0 === "skillId" ||
              key0 === "explanationAr" ||
              key0 === "needsProbe"
            )
          ) {
            validate39.errors = [
              {
                instancePath,
                schemaPath: "#/additionalProperties",
                keyword: "additionalProperties",
                params: { additionalProperty: key0 },
                message: "must NOT have additional properties",
              },
            ];
            return false;
            break;
          }
        }
        if (_errs1 === errors) {
          if (data.diagnosisId !== undefined) {
            let data0 = data.diagnosisId;
            const _errs2 = errors;
            const _errs3 = errors;
            let valid1 = false;
            const _errs4 = errors;
            if (errors === _errs4) {
              if (errors === _errs4) {
                if (typeof data0 === "string") {
                  if (!formats4.test(data0)) {
                    const err0 = {
                      instancePath: instancePath + "/diagnosisId",
                      schemaPath: "#/properties/diagnosisId/anyOf/0/format",
                      keyword: "format",
                      params: { format: "uuid" },
                      message: 'must match format "' + "uuid" + '"',
                    };
                    if (vErrors === null) {
                      vErrors = [err0];
                    } else {
                      vErrors.push(err0);
                    }
                    errors++;
                  }
                } else {
                  const err1 = {
                    instancePath: instancePath + "/diagnosisId",
                    schemaPath: "#/properties/diagnosisId/anyOf/0/type",
                    keyword: "type",
                    params: { type: "string" },
                    message: "must be string",
                  };
                  if (vErrors === null) {
                    vErrors = [err1];
                  } else {
                    vErrors.push(err1);
                  }
                  errors++;
                }
              }
            }
            var _valid0 = _errs4 === errors;
            valid1 = valid1 || _valid0;
            const _errs6 = errors;
            if (data0 !== null) {
              const err2 = {
                instancePath: instancePath + "/diagnosisId",
                schemaPath: "#/properties/diagnosisId/anyOf/1/type",
                keyword: "type",
                params: { type: "null" },
                message: "must be null",
              };
              if (vErrors === null) {
                vErrors = [err2];
              } else {
                vErrors.push(err2);
              }
              errors++;
            }
            var _valid0 = _errs6 === errors;
            valid1 = valid1 || _valid0;
            if (!valid1) {
              const err3 = {
                instancePath: instancePath + "/diagnosisId",
                schemaPath: "#/properties/diagnosisId/anyOf",
                keyword: "anyOf",
                params: {},
                message: "must match a schema in anyOf",
              };
              if (vErrors === null) {
                vErrors = [err3];
              } else {
                vErrors.push(err3);
              }
              errors++;
              validate39.errors = vErrors;
              return false;
            } else {
              errors = _errs3;
              if (vErrors !== null) {
                if (_errs3) {
                  vErrors.length = _errs3;
                } else {
                  vErrors = null;
                }
              }
            }
            var valid0 = _errs2 === errors;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.state !== undefined) {
              let data1 = data.state;
              const _errs8 = errors;
              if (typeof data1 !== "string") {
                validate39.errors = [
                  {
                    instancePath: instancePath + "/state",
                    schemaPath: "#/components/schemas/DiagnosisState/type",
                    keyword: "type",
                    params: { type: "string" },
                    message: "must be string",
                  },
                ];
                return false;
              }
              if (
                !(
                  data1 === "tentative" ||
                  data1 === "needs_probe" ||
                  data1 === "supported_by_probe" ||
                  data1 === "rejected" ||
                  data1 === "unresolved"
                )
              ) {
                validate39.errors = [
                  {
                    instancePath: instancePath + "/state",
                    schemaPath: "#/components/schemas/DiagnosisState/enum",
                    keyword: "enum",
                    params: { allowedValues: schema55.enum },
                    message: "must be equal to one of the allowed values",
                  },
                ];
                return false;
              }
              var valid0 = _errs8 === errors;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.errorCode !== undefined) {
                let data2 = data.errorCode;
                const _errs11 = errors;
                const _errs12 = errors;
                let valid3 = false;
                const _errs13 = errors;
                if (errors === _errs13) {
                  if (typeof data2 === "string") {
                    if (!pattern8.test(data2)) {
                      const err4 = {
                        instancePath: instancePath + "/errorCode",
                        schemaPath: "#/properties/errorCode/anyOf/0/pattern",
                        keyword: "pattern",
                        params: { pattern: "^ERR-ALG-0[1-6]$" },
                        message:
                          'must match pattern "' + "^ERR-ALG-0[1-6]$" + '"',
                      };
                      if (vErrors === null) {
                        vErrors = [err4];
                      } else {
                        vErrors.push(err4);
                      }
                      errors++;
                    }
                  } else {
                    const err5 = {
                      instancePath: instancePath + "/errorCode",
                      schemaPath: "#/properties/errorCode/anyOf/0/type",
                      keyword: "type",
                      params: { type: "string" },
                      message: "must be string",
                    };
                    if (vErrors === null) {
                      vErrors = [err5];
                    } else {
                      vErrors.push(err5);
                    }
                    errors++;
                  }
                }
                var _valid1 = _errs13 === errors;
                valid3 = valid3 || _valid1;
                const _errs15 = errors;
                if (data2 !== null) {
                  const err6 = {
                    instancePath: instancePath + "/errorCode",
                    schemaPath: "#/properties/errorCode/anyOf/1/type",
                    keyword: "type",
                    params: { type: "null" },
                    message: "must be null",
                  };
                  if (vErrors === null) {
                    vErrors = [err6];
                  } else {
                    vErrors.push(err6);
                  }
                  errors++;
                }
                var _valid1 = _errs15 === errors;
                valid3 = valid3 || _valid1;
                if (!valid3) {
                  const err7 = {
                    instancePath: instancePath + "/errorCode",
                    schemaPath: "#/properties/errorCode/anyOf",
                    keyword: "anyOf",
                    params: {},
                    message: "must match a schema in anyOf",
                  };
                  if (vErrors === null) {
                    vErrors = [err7];
                  } else {
                    vErrors.push(err7);
                  }
                  errors++;
                  validate39.errors = vErrors;
                  return false;
                } else {
                  errors = _errs12;
                  if (vErrors !== null) {
                    if (_errs12) {
                      vErrors.length = _errs12;
                    } else {
                      vErrors = null;
                    }
                  }
                }
                var valid0 = _errs11 === errors;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.skillId !== undefined) {
                  let data3 = data.skillId;
                  const _errs17 = errors;
                  const _errs18 = errors;
                  let valid4 = false;
                  const _errs19 = errors;
                  if (errors === _errs19) {
                    if (errors === _errs19) {
                      if (typeof data3 === "string") {
                        if (!formats4.test(data3)) {
                          const err8 = {
                            instancePath: instancePath + "/skillId",
                            schemaPath: "#/properties/skillId/anyOf/0/format",
                            keyword: "format",
                            params: { format: "uuid" },
                            message: 'must match format "' + "uuid" + '"',
                          };
                          if (vErrors === null) {
                            vErrors = [err8];
                          } else {
                            vErrors.push(err8);
                          }
                          errors++;
                        }
                      } else {
                        const err9 = {
                          instancePath: instancePath + "/skillId",
                          schemaPath: "#/properties/skillId/anyOf/0/type",
                          keyword: "type",
                          params: { type: "string" },
                          message: "must be string",
                        };
                        if (vErrors === null) {
                          vErrors = [err9];
                        } else {
                          vErrors.push(err9);
                        }
                        errors++;
                      }
                    }
                  }
                  var _valid2 = _errs19 === errors;
                  valid4 = valid4 || _valid2;
                  const _errs21 = errors;
                  if (data3 !== null) {
                    const err10 = {
                      instancePath: instancePath + "/skillId",
                      schemaPath: "#/properties/skillId/anyOf/1/type",
                      keyword: "type",
                      params: { type: "null" },
                      message: "must be null",
                    };
                    if (vErrors === null) {
                      vErrors = [err10];
                    } else {
                      vErrors.push(err10);
                    }
                    errors++;
                  }
                  var _valid2 = _errs21 === errors;
                  valid4 = valid4 || _valid2;
                  if (!valid4) {
                    const err11 = {
                      instancePath: instancePath + "/skillId",
                      schemaPath: "#/properties/skillId/anyOf",
                      keyword: "anyOf",
                      params: {},
                      message: "must match a schema in anyOf",
                    };
                    if (vErrors === null) {
                      vErrors = [err11];
                    } else {
                      vErrors.push(err11);
                    }
                    errors++;
                    validate39.errors = vErrors;
                    return false;
                  } else {
                    errors = _errs18;
                    if (vErrors !== null) {
                      if (_errs18) {
                        vErrors.length = _errs18;
                      } else {
                        vErrors = null;
                      }
                    }
                  }
                  var valid0 = _errs17 === errors;
                } else {
                  var valid0 = true;
                }
                if (valid0) {
                  if (data.explanationAr !== undefined) {
                    const _errs23 = errors;
                    if (typeof data.explanationAr !== "string") {
                      validate39.errors = [
                        {
                          instancePath: instancePath + "/explanationAr",
                          schemaPath: "#/properties/explanationAr/type",
                          keyword: "type",
                          params: { type: "string" },
                          message: "must be string",
                        },
                      ];
                      return false;
                    }
                    var valid0 = _errs23 === errors;
                  } else {
                    var valid0 = true;
                  }
                  if (valid0) {
                    if (data.needsProbe !== undefined) {
                      const _errs25 = errors;
                      if (typeof data.needsProbe !== "boolean") {
                        validate39.errors = [
                          {
                            instancePath: instancePath + "/needsProbe",
                            schemaPath: "#/properties/needsProbe/type",
                            keyword: "type",
                            params: { type: "boolean" },
                            message: "must be boolean",
                          },
                        ];
                        return false;
                      }
                      var valid0 = _errs25 === errors;
                    } else {
                      var valid0 = true;
                    }
                  }
                }
              }
            }
          }
        }
      }
    } else {
      validate39.errors = [
        {
          instancePath,
          schemaPath: "#/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        },
      ];
      return false;
    }
  }
  validate39.errors = vErrors;
  return errors === 0;
}
validate39.evaluated = {
  props: true,
  dynamicProps: false,
  dynamicItems: false,
};
function validate29(
  data,
  {
    instancePath = "",
    parentData,
    parentDataProperty,
    rootData = data,
    dynamicAnchors = {},
  } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate29.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (errors === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (
        (data.id === undefined && (missing0 = "id")) ||
        (data.attemptId === undefined && (missing0 = "attemptId")) ||
        (data.attemptRevision === undefined &&
          (missing0 = "attemptRevision")) ||
        (data.problemRevisionId === undefined &&
          (missing0 = "problemRevisionId")) ||
        (data.scope === undefined && (missing0 = "scope")) ||
        (data.isCurrent === undefined && (missing0 = "isCurrent")) ||
        (data.transitions === undefined && (missing0 = "transitions")) ||
        (data.firstBlockingTransitionIndex === undefined &&
          (missing0 = "firstBlockingTransitionIndex")) ||
        (data.completion === undefined && (missing0 = "completion")) ||
        (data.diagnosisCandidate === undefined &&
          (missing0 = "diagnosisCandidate"))
      ) {
        validate29.errors = [
          {
            instancePath,
            schemaPath: "#/required",
            keyword: "required",
            params: { missingProperty: missing0 },
            message: "must have required property '" + missing0 + "'",
          },
        ];
        return false;
      } else {
        const _errs1 = errors;
        for (const key0 in data) {
          if (!func1.call(schema43.properties, key0)) {
            validate29.errors = [
              {
                instancePath,
                schemaPath: "#/additionalProperties",
                keyword: "additionalProperties",
                params: { additionalProperty: key0 },
                message: "must NOT have additional properties",
              },
            ];
            return false;
            break;
          }
        }
        if (_errs1 === errors) {
          if (data.id !== undefined) {
            let data0 = data.id;
            const _errs2 = errors;
            if (errors === _errs2) {
              if (errors === _errs2) {
                if (typeof data0 === "string") {
                  if (!formats4.test(data0)) {
                    validate29.errors = [
                      {
                        instancePath: instancePath + "/id",
                        schemaPath: "#/properties/id/format",
                        keyword: "format",
                        params: { format: "uuid" },
                        message: 'must match format "' + "uuid" + '"',
                      },
                    ];
                    return false;
                  }
                } else {
                  validate29.errors = [
                    {
                      instancePath: instancePath + "/id",
                      schemaPath: "#/properties/id/type",
                      keyword: "type",
                      params: { type: "string" },
                      message: "must be string",
                    },
                  ];
                  return false;
                }
              }
            }
            var valid0 = _errs2 === errors;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.attemptId !== undefined) {
              let data1 = data.attemptId;
              const _errs4 = errors;
              if (errors === _errs4) {
                if (errors === _errs4) {
                  if (typeof data1 === "string") {
                    if (!formats4.test(data1)) {
                      validate29.errors = [
                        {
                          instancePath: instancePath + "/attemptId",
                          schemaPath: "#/properties/attemptId/format",
                          keyword: "format",
                          params: { format: "uuid" },
                          message: 'must match format "' + "uuid" + '"',
                        },
                      ];
                      return false;
                    }
                  } else {
                    validate29.errors = [
                      {
                        instancePath: instancePath + "/attemptId",
                        schemaPath: "#/properties/attemptId/type",
                        keyword: "type",
                        params: { type: "string" },
                        message: "must be string",
                      },
                    ];
                    return false;
                  }
                }
              }
              var valid0 = _errs4 === errors;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.attemptRevision !== undefined) {
                let data2 = data.attemptRevision;
                const _errs6 = errors;
                if (
                  !(typeof data2 == "number" && !(data2 % 1) && !isNaN(data2))
                ) {
                  validate29.errors = [
                    {
                      instancePath: instancePath + "/attemptRevision",
                      schemaPath: "#/properties/attemptRevision/type",
                      keyword: "type",
                      params: { type: "integer" },
                      message: "must be integer",
                    },
                  ];
                  return false;
                }
                if (errors === _errs6) {
                  if (typeof data2 == "number") {
                    if (data2 > 2147483647 || isNaN(data2)) {
                      validate29.errors = [
                        {
                          instancePath: instancePath + "/attemptRevision",
                          schemaPath: "#/properties/attemptRevision/maximum",
                          keyword: "maximum",
                          params: { comparison: "<=", limit: 2147483647 },
                          message: "must be <= 2147483647",
                        },
                      ];
                      return false;
                    } else {
                      if (data2 < 0 || isNaN(data2)) {
                        validate29.errors = [
                          {
                            instancePath: instancePath + "/attemptRevision",
                            schemaPath: "#/properties/attemptRevision/minimum",
                            keyword: "minimum",
                            params: { comparison: ">=", limit: 0 },
                            message: "must be >= 0",
                          },
                        ];
                        return false;
                      } else {
                        if (!formats0.validate(data2)) {
                          validate29.errors = [
                            {
                              instancePath: instancePath + "/attemptRevision",
                              schemaPath: "#/properties/attemptRevision/format",
                              keyword: "format",
                              params: { format: "int32" },
                              message: 'must match format "' + "int32" + '"',
                            },
                          ];
                          return false;
                        }
                      }
                    }
                  }
                }
                var valid0 = _errs6 === errors;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.problemRevisionId !== undefined) {
                  let data3 = data.problemRevisionId;
                  const _errs8 = errors;
                  if (errors === _errs8) {
                    if (errors === _errs8) {
                      if (typeof data3 === "string") {
                        if (!formats4.test(data3)) {
                          validate29.errors = [
                            {
                              instancePath: instancePath + "/problemRevisionId",
                              schemaPath:
                                "#/properties/problemRevisionId/format",
                              keyword: "format",
                              params: { format: "uuid" },
                              message: 'must match format "' + "uuid" + '"',
                            },
                          ];
                          return false;
                        }
                      } else {
                        validate29.errors = [
                          {
                            instancePath: instancePath + "/problemRevisionId",
                            schemaPath: "#/properties/problemRevisionId/type",
                            keyword: "type",
                            params: { type: "string" },
                            message: "must be string",
                          },
                        ];
                        return false;
                      }
                    }
                  }
                  var valid0 = _errs8 === errors;
                } else {
                  var valid0 = true;
                }
                if (valid0) {
                  if (data.scope !== undefined) {
                    let data4 = data.scope;
                    const _errs10 = errors;
                    if (typeof data4 !== "string") {
                      validate29.errors = [
                        {
                          instancePath: instancePath + "/scope",
                          schemaPath:
                            "#/components/schemas/VerificationScope/type",
                          keyword: "type",
                          params: { type: "string" },
                          message: "must be string",
                        },
                      ];
                      return false;
                    }
                    if (
                      !(data4 === "target_edge" || data4 === "current_sequence")
                    ) {
                      validate29.errors = [
                        {
                          instancePath: instancePath + "/scope",
                          schemaPath:
                            "#/components/schemas/VerificationScope/enum",
                          keyword: "enum",
                          params: { allowedValues: schema44.enum },
                          message: "must be equal to one of the allowed values",
                        },
                      ];
                      return false;
                    }
                    var valid0 = _errs10 === errors;
                  } else {
                    var valid0 = true;
                  }
                  if (valid0) {
                    if (data.isCurrent !== undefined) {
                      const _errs13 = errors;
                      if (typeof data.isCurrent !== "boolean") {
                        validate29.errors = [
                          {
                            instancePath: instancePath + "/isCurrent",
                            schemaPath: "#/properties/isCurrent/type",
                            keyword: "type",
                            params: { type: "boolean" },
                            message: "must be boolean",
                          },
                        ];
                        return false;
                      }
                      var valid0 = _errs13 === errors;
                    } else {
                      var valid0 = true;
                    }
                    if (valid0) {
                      if (data.transitions !== undefined) {
                        let data6 = data.transitions;
                        const _errs15 = errors;
                        if (errors === _errs15) {
                          if (Array.isArray(data6)) {
                            if (data6.length < 1) {
                              validate29.errors = [
                                {
                                  instancePath: instancePath + "/transitions",
                                  schemaPath:
                                    "#/properties/transitions/minItems",
                                  keyword: "minItems",
                                  params: { limit: 1 },
                                  message: "must NOT have fewer than 1 items",
                                },
                              ];
                              return false;
                            } else {
                              var valid2 = true;
                              const len0 = data6.length;
                              for (let i0 = 0; i0 < len0; i0++) {
                                const _errs17 = errors;
                                if (
                                  !validate30(data6[i0], {
                                    instancePath:
                                      instancePath + "/transitions/" + i0,
                                    parentData: data6,
                                    parentDataProperty: i0,
                                    rootData,
                                    dynamicAnchors,
                                  })
                                ) {
                                  vErrors =
                                    vErrors === null
                                      ? validate30.errors
                                      : vErrors.concat(validate30.errors);
                                  errors = vErrors.length;
                                }
                                var valid2 = _errs17 === errors;
                                if (!valid2) {
                                  break;
                                }
                              }
                            }
                          } else {
                            validate29.errors = [
                              {
                                instancePath: instancePath + "/transitions",
                                schemaPath: "#/properties/transitions/type",
                                keyword: "type",
                                params: { type: "array" },
                                message: "must be array",
                              },
                            ];
                            return false;
                          }
                        }
                        var valid0 = _errs15 === errors;
                      } else {
                        var valid0 = true;
                      }
                      if (valid0) {
                        if (data.firstBlockingTransitionIndex !== undefined) {
                          let data8 = data.firstBlockingTransitionIndex;
                          const _errs18 = errors;
                          const _errs19 = errors;
                          let valid3 = false;
                          const _errs20 = errors;
                          if (
                            !(
                              typeof data8 == "number" &&
                              !(data8 % 1) &&
                              !isNaN(data8)
                            )
                          ) {
                            const err0 = {
                              instancePath:
                                instancePath + "/firstBlockingTransitionIndex",
                              schemaPath:
                                "#/properties/firstBlockingTransitionIndex/anyOf/0/type",
                              keyword: "type",
                              params: { type: "integer" },
                              message: "must be integer",
                            };
                            if (vErrors === null) {
                              vErrors = [err0];
                            } else {
                              vErrors.push(err0);
                            }
                            errors++;
                          }
                          if (errors === _errs20) {
                            if (typeof data8 == "number") {
                              if (data8 < 0 || isNaN(data8)) {
                                const err1 = {
                                  instancePath:
                                    instancePath +
                                    "/firstBlockingTransitionIndex",
                                  schemaPath:
                                    "#/properties/firstBlockingTransitionIndex/anyOf/0/minimum",
                                  keyword: "minimum",
                                  params: { comparison: ">=", limit: 0 },
                                  message: "must be >= 0",
                                };
                                if (vErrors === null) {
                                  vErrors = [err1];
                                } else {
                                  vErrors.push(err1);
                                }
                                errors++;
                              } else {
                                if (!formats0.validate(data8)) {
                                  const err2 = {
                                    instancePath:
                                      instancePath +
                                      "/firstBlockingTransitionIndex",
                                    schemaPath:
                                      "#/properties/firstBlockingTransitionIndex/anyOf/0/format",
                                    keyword: "format",
                                    params: { format: "int32" },
                                    message:
                                      'must match format "' + "int32" + '"',
                                  };
                                  if (vErrors === null) {
                                    vErrors = [err2];
                                  } else {
                                    vErrors.push(err2);
                                  }
                                  errors++;
                                }
                              }
                            }
                          }
                          var _valid0 = _errs20 === errors;
                          valid3 = valid3 || _valid0;
                          const _errs22 = errors;
                          if (data8 !== null) {
                            const err3 = {
                              instancePath:
                                instancePath + "/firstBlockingTransitionIndex",
                              schemaPath:
                                "#/properties/firstBlockingTransitionIndex/anyOf/1/type",
                              keyword: "type",
                              params: { type: "null" },
                              message: "must be null",
                            };
                            if (vErrors === null) {
                              vErrors = [err3];
                            } else {
                              vErrors.push(err3);
                            }
                            errors++;
                          }
                          var _valid0 = _errs22 === errors;
                          valid3 = valid3 || _valid0;
                          if (!valid3) {
                            const err4 = {
                              instancePath:
                                instancePath + "/firstBlockingTransitionIndex",
                              schemaPath:
                                "#/properties/firstBlockingTransitionIndex/anyOf",
                              keyword: "anyOf",
                              params: {},
                              message: "must match a schema in anyOf",
                            };
                            if (vErrors === null) {
                              vErrors = [err4];
                            } else {
                              vErrors.push(err4);
                            }
                            errors++;
                            validate29.errors = vErrors;
                            return false;
                          } else {
                            errors = _errs19;
                            if (vErrors !== null) {
                              if (_errs19) {
                                vErrors.length = _errs19;
                              } else {
                                vErrors = null;
                              }
                            }
                          }
                          var valid0 = _errs18 === errors;
                        } else {
                          var valid0 = true;
                        }
                        if (valid0) {
                          if (data.completion !== undefined) {
                            let data9 = data.completion;
                            const _errs24 = errors;
                            const _errs25 = errors;
                            if (errors === _errs25) {
                              if (
                                data9 &&
                                typeof data9 == "object" &&
                                !Array.isArray(data9)
                              ) {
                                let missing1;
                                if (
                                  (data9.state === undefined &&
                                    (missing1 = "state")) ||
                                  (data9.canMarkAttemptCompleted ===
                                    undefined &&
                                    (missing1 = "canMarkAttemptCompleted")) ||
                                  (data9.explanationAr === undefined &&
                                    (missing1 = "explanationAr"))
                                ) {
                                  validate29.errors = [
                                    {
                                      instancePath:
                                        instancePath + "/completion",
                                      schemaPath:
                                        "#/components/schemas/Completion/required",
                                      keyword: "required",
                                      params: { missingProperty: missing1 },
                                      message:
                                        "must have required property '" +
                                        missing1 +
                                        "'",
                                    },
                                  ];
                                  return false;
                                } else {
                                  const _errs27 = errors;
                                  for (const key1 in data9) {
                                    if (
                                      !(
                                        key1 === "state" ||
                                        key1 === "canMarkAttemptCompleted" ||
                                        key1 === "explanationAr"
                                      )
                                    ) {
                                      validate29.errors = [
                                        {
                                          instancePath:
                                            instancePath + "/completion",
                                          schemaPath:
                                            "#/components/schemas/Completion/additionalProperties",
                                          keyword: "additionalProperties",
                                          params: { additionalProperty: key1 },
                                          message:
                                            "must NOT have additional properties",
                                        },
                                      ];
                                      return false;
                                      break;
                                    }
                                  }
                                  if (_errs27 === errors) {
                                    if (data9.state !== undefined) {
                                      let data10 = data9.state;
                                      const _errs28 = errors;
                                      if (typeof data10 !== "string") {
                                        validate29.errors = [
                                          {
                                            instancePath:
                                              instancePath +
                                              "/completion/state",
                                            schemaPath:
                                              "#/components/schemas/Completion/properties/state/type",
                                            keyword: "type",
                                            params: { type: "string" },
                                            message: "must be string",
                                          },
                                        ];
                                        return false;
                                      }
                                      if (
                                        !(
                                          data10 === "not_complete" ||
                                          data10 === "verified_complete" ||
                                          data10 === "unknown"
                                        )
                                      ) {
                                        validate29.errors = [
                                          {
                                            instancePath:
                                              instancePath +
                                              "/completion/state",
                                            schemaPath:
                                              "#/components/schemas/Completion/properties/state/enum",
                                            keyword: "enum",
                                            params: {
                                              allowedValues:
                                                schema53.properties.state.enum,
                                            },
                                            message:
                                              "must be equal to one of the allowed values",
                                          },
                                        ];
                                        return false;
                                      }
                                      var valid5 = _errs28 === errors;
                                    } else {
                                      var valid5 = true;
                                    }
                                    if (valid5) {
                                      if (
                                        data9.canMarkAttemptCompleted !==
                                        undefined
                                      ) {
                                        const _errs30 = errors;
                                        if (
                                          typeof data9.canMarkAttemptCompleted !==
                                          "boolean"
                                        ) {
                                          validate29.errors = [
                                            {
                                              instancePath:
                                                instancePath +
                                                "/completion/canMarkAttemptCompleted",
                                              schemaPath:
                                                "#/components/schemas/Completion/properties/canMarkAttemptCompleted/type",
                                              keyword: "type",
                                              params: { type: "boolean" },
                                              message: "must be boolean",
                                            },
                                          ];
                                          return false;
                                        }
                                        var valid5 = _errs30 === errors;
                                      } else {
                                        var valid5 = true;
                                      }
                                      if (valid5) {
                                        if (data9.explanationAr !== undefined) {
                                          const _errs32 = errors;
                                          if (
                                            typeof data9.explanationAr !==
                                            "string"
                                          ) {
                                            validate29.errors = [
                                              {
                                                instancePath:
                                                  instancePath +
                                                  "/completion/explanationAr",
                                                schemaPath:
                                                  "#/components/schemas/Completion/properties/explanationAr/type",
                                                keyword: "type",
                                                params: { type: "string" },
                                                message: "must be string",
                                              },
                                            ];
                                            return false;
                                          }
                                          var valid5 = _errs32 === errors;
                                        } else {
                                          var valid5 = true;
                                        }
                                      }
                                    }
                                  }
                                }
                              } else {
                                validate29.errors = [
                                  {
                                    instancePath: instancePath + "/completion",
                                    schemaPath:
                                      "#/components/schemas/Completion/type",
                                    keyword: "type",
                                    params: { type: "object" },
                                    message: "must be object",
                                  },
                                ];
                                return false;
                              }
                            }
                            var valid0 = _errs24 === errors;
                          } else {
                            var valid0 = true;
                          }
                          if (valid0) {
                            if (data.diagnosisCandidate !== undefined) {
                              let data13 = data.diagnosisCandidate;
                              const _errs34 = errors;
                              const _errs35 = errors;
                              let valid6 = false;
                              const _errs36 = errors;
                              if (
                                !validate39(data13, {
                                  instancePath:
                                    instancePath + "/diagnosisCandidate",
                                  parentData: data,
                                  parentDataProperty: "diagnosisCandidate",
                                  rootData,
                                  dynamicAnchors,
                                })
                              ) {
                                vErrors =
                                  vErrors === null
                                    ? validate39.errors
                                    : vErrors.concat(validate39.errors);
                                errors = vErrors.length;
                              }
                              var _valid1 = _errs36 === errors;
                              valid6 = valid6 || _valid1;
                              const _errs37 = errors;
                              if (data13 !== null) {
                                const err5 = {
                                  instancePath:
                                    instancePath + "/diagnosisCandidate",
                                  schemaPath:
                                    "#/properties/diagnosisCandidate/anyOf/1/type",
                                  keyword: "type",
                                  params: { type: "null" },
                                  message: "must be null",
                                };
                                if (vErrors === null) {
                                  vErrors = [err5];
                                } else {
                                  vErrors.push(err5);
                                }
                                errors++;
                              }
                              var _valid1 = _errs37 === errors;
                              valid6 = valid6 || _valid1;
                              if (!valid6) {
                                const err6 = {
                                  instancePath:
                                    instancePath + "/diagnosisCandidate",
                                  schemaPath:
                                    "#/properties/diagnosisCandidate/anyOf",
                                  keyword: "anyOf",
                                  params: {},
                                  message: "must match a schema in anyOf",
                                };
                                if (vErrors === null) {
                                  vErrors = [err6];
                                } else {
                                  vErrors.push(err6);
                                }
                                errors++;
                                validate29.errors = vErrors;
                                return false;
                              } else {
                                errors = _errs35;
                                if (vErrors !== null) {
                                  if (_errs35) {
                                    vErrors.length = _errs35;
                                  } else {
                                    vErrors = null;
                                  }
                                }
                              }
                              var valid0 = _errs34 === errors;
                            } else {
                              var valid0 = true;
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    } else {
      validate29.errors = [
        {
          instancePath,
          schemaPath: "#/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        },
      ];
      return false;
    }
  }
  validate29.errors = vErrors;
  return errors === 0;
}
validate29.evaluated = {
  props: true,
  dynamicProps: false,
  dynamicItems: false,
};
function validate26(
  data,
  {
    instancePath = "",
    parentData,
    parentDataProperty,
    rootData = data,
    dynamicAnchors = {},
  } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate26.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (errors === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (
        (data.id === undefined && (missing0 = "id")) ||
        (data.learningSessionId === undefined &&
          (missing0 = "learningSessionId")) ||
        (data.problemRevisionId === undefined &&
          (missing0 = "problemRevisionId")) ||
        (data.kind === undefined && (missing0 = "kind")) ||
        (data.revision === undefined && (missing0 = "revision")) ||
        (data.status === undefined && (missing0 = "status")) ||
        (data.completionVerdict === undefined &&
          (missing0 = "completionVerdict")) ||
        (data.notationProfile === undefined &&
          (missing0 = "notationProfile")) ||
        (data.steps === undefined && (missing0 = "steps")) ||
        (data.openedAt === undefined && (missing0 = "openedAt")) ||
        (data.updatedAt === undefined && (missing0 = "updatedAt")) ||
        (data.parentEpisodeId === undefined &&
          (missing0 = "parentEpisodeId")) ||
        (data.currentVerification === undefined &&
          (missing0 = "currentVerification"))
      ) {
        validate26.errors = [
          {
            instancePath,
            schemaPath: "#/required",
            keyword: "required",
            params: { missingProperty: missing0 },
            message: "must have required property '" + missing0 + "'",
          },
        ];
        return false;
      } else {
        const _errs1 = errors;
        for (const key0 in data) {
          if (!func1.call(schema38.properties, key0)) {
            validate26.errors = [
              {
                instancePath,
                schemaPath: "#/additionalProperties",
                keyword: "additionalProperties",
                params: { additionalProperty: key0 },
                message: "must NOT have additional properties",
              },
            ];
            return false;
            break;
          }
        }
        if (_errs1 === errors) {
          if (data.id !== undefined) {
            let data0 = data.id;
            const _errs2 = errors;
            if (errors === _errs2) {
              if (errors === _errs2) {
                if (typeof data0 === "string") {
                  if (!formats4.test(data0)) {
                    validate26.errors = [
                      {
                        instancePath: instancePath + "/id",
                        schemaPath: "#/properties/id/format",
                        keyword: "format",
                        params: { format: "uuid" },
                        message: 'must match format "' + "uuid" + '"',
                      },
                    ];
                    return false;
                  }
                } else {
                  validate26.errors = [
                    {
                      instancePath: instancePath + "/id",
                      schemaPath: "#/properties/id/type",
                      keyword: "type",
                      params: { type: "string" },
                      message: "must be string",
                    },
                  ];
                  return false;
                }
              }
            }
            var valid0 = _errs2 === errors;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.learningSessionId !== undefined) {
              let data1 = data.learningSessionId;
              const _errs4 = errors;
              if (errors === _errs4) {
                if (errors === _errs4) {
                  if (typeof data1 === "string") {
                    if (!formats4.test(data1)) {
                      validate26.errors = [
                        {
                          instancePath: instancePath + "/learningSessionId",
                          schemaPath: "#/properties/learningSessionId/format",
                          keyword: "format",
                          params: { format: "uuid" },
                          message: 'must match format "' + "uuid" + '"',
                        },
                      ];
                      return false;
                    }
                  } else {
                    validate26.errors = [
                      {
                        instancePath: instancePath + "/learningSessionId",
                        schemaPath: "#/properties/learningSessionId/type",
                        keyword: "type",
                        params: { type: "string" },
                        message: "must be string",
                      },
                    ];
                    return false;
                  }
                }
              }
              var valid0 = _errs4 === errors;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.problemRevisionId !== undefined) {
                let data2 = data.problemRevisionId;
                const _errs6 = errors;
                if (errors === _errs6) {
                  if (errors === _errs6) {
                    if (typeof data2 === "string") {
                      if (!formats4.test(data2)) {
                        validate26.errors = [
                          {
                            instancePath: instancePath + "/problemRevisionId",
                            schemaPath: "#/properties/problemRevisionId/format",
                            keyword: "format",
                            params: { format: "uuid" },
                            message: 'must match format "' + "uuid" + '"',
                          },
                        ];
                        return false;
                      }
                    } else {
                      validate26.errors = [
                        {
                          instancePath: instancePath + "/problemRevisionId",
                          schemaPath: "#/properties/problemRevisionId/type",
                          keyword: "type",
                          params: { type: "string" },
                          message: "must be string",
                        },
                      ];
                      return false;
                    }
                  }
                }
                var valid0 = _errs6 === errors;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.kind !== undefined) {
                  let data3 = data.kind;
                  const _errs8 = errors;
                  if (typeof data3 !== "string") {
                    validate26.errors = [
                      {
                        instancePath: instancePath + "/kind",
                        schemaPath: "#/components/schemas/AttemptKind/type",
                        keyword: "type",
                        params: { type: "string" },
                        message: "must be string",
                      },
                    ];
                    return false;
                  }
                  if (
                    !(
                      data3 === "main" ||
                      data3 === "probe" ||
                      data3 === "remediation" ||
                      data3 === "transfer"
                    )
                  ) {
                    validate26.errors = [
                      {
                        instancePath: instancePath + "/kind",
                        schemaPath: "#/components/schemas/AttemptKind/enum",
                        keyword: "enum",
                        params: { allowedValues: schema39.enum },
                        message: "must be equal to one of the allowed values",
                      },
                    ];
                    return false;
                  }
                  var valid0 = _errs8 === errors;
                } else {
                  var valid0 = true;
                }
                if (valid0) {
                  if (data.revision !== undefined) {
                    let data4 = data.revision;
                    const _errs11 = errors;
                    if (
                      !(
                        typeof data4 == "number" &&
                        !(data4 % 1) &&
                        !isNaN(data4)
                      )
                    ) {
                      validate26.errors = [
                        {
                          instancePath: instancePath + "/revision",
                          schemaPath: "#/properties/revision/type",
                          keyword: "type",
                          params: { type: "integer" },
                          message: "must be integer",
                        },
                      ];
                      return false;
                    }
                    if (errors === _errs11) {
                      if (typeof data4 == "number") {
                        if (data4 > 2147483647 || isNaN(data4)) {
                          validate26.errors = [
                            {
                              instancePath: instancePath + "/revision",
                              schemaPath: "#/properties/revision/maximum",
                              keyword: "maximum",
                              params: { comparison: "<=", limit: 2147483647 },
                              message: "must be <= 2147483647",
                            },
                          ];
                          return false;
                        } else {
                          if (data4 < 0 || isNaN(data4)) {
                            validate26.errors = [
                              {
                                instancePath: instancePath + "/revision",
                                schemaPath: "#/properties/revision/minimum",
                                keyword: "minimum",
                                params: { comparison: ">=", limit: 0 },
                                message: "must be >= 0",
                              },
                            ];
                            return false;
                          } else {
                            if (!formats0.validate(data4)) {
                              validate26.errors = [
                                {
                                  instancePath: instancePath + "/revision",
                                  schemaPath: "#/properties/revision/format",
                                  keyword: "format",
                                  params: { format: "int32" },
                                  message:
                                    'must match format "' + "int32" + '"',
                                },
                              ];
                              return false;
                            }
                          }
                        }
                      }
                    }
                    var valid0 = _errs11 === errors;
                  } else {
                    var valid0 = true;
                  }
                  if (valid0) {
                    if (data.status !== undefined) {
                      let data5 = data.status;
                      const _errs13 = errors;
                      if (typeof data5 !== "string") {
                        validate26.errors = [
                          {
                            instancePath: instancePath + "/status",
                            schemaPath:
                              "#/components/schemas/AttemptStatus/type",
                            keyword: "type",
                            params: { type: "string" },
                            message: "must be string",
                          },
                        ];
                        return false;
                      }
                      if (
                        !(
                          data5 === "in_progress" ||
                          data5 === "completed" ||
                          data5 === "assisted_completed" ||
                          data5 === "stopped"
                        )
                      ) {
                        validate26.errors = [
                          {
                            instancePath: instancePath + "/status",
                            schemaPath:
                              "#/components/schemas/AttemptStatus/enum",
                            keyword: "enum",
                            params: { allowedValues: schema40.enum },
                            message:
                              "must be equal to one of the allowed values",
                          },
                        ];
                        return false;
                      }
                      var valid0 = _errs13 === errors;
                    } else {
                      var valid0 = true;
                    }
                    if (valid0) {
                      if (data.completionVerdict !== undefined) {
                        let data6 = data.completionVerdict;
                        const _errs16 = errors;
                        const _errs17 = errors;
                        let valid3 = false;
                        const _errs18 = errors;
                        if (typeof data6 !== "string") {
                          const err0 = {
                            instancePath: instancePath + "/completionVerdict",
                            schemaPath:
                              "#/properties/completionVerdict/anyOf/0/type",
                            keyword: "type",
                            params: { type: "string" },
                            message: "must be string",
                          };
                          if (vErrors === null) {
                            vErrors = [err0];
                          } else {
                            vErrors.push(err0);
                          }
                          errors++;
                        }
                        if (
                          !(
                            data6 === "verified_complete" ||
                            data6 === "not_complete" ||
                            data6 === "unknown"
                          )
                        ) {
                          const err1 = {
                            instancePath: instancePath + "/completionVerdict",
                            schemaPath:
                              "#/properties/completionVerdict/anyOf/0/enum",
                            keyword: "enum",
                            params: {
                              allowedValues:
                                schema38.properties.completionVerdict.anyOf[0]
                                  .enum,
                            },
                            message:
                              "must be equal to one of the allowed values",
                          };
                          if (vErrors === null) {
                            vErrors = [err1];
                          } else {
                            vErrors.push(err1);
                          }
                          errors++;
                        }
                        var _valid0 = _errs18 === errors;
                        valid3 = valid3 || _valid0;
                        const _errs20 = errors;
                        if (data6 !== null) {
                          const err2 = {
                            instancePath: instancePath + "/completionVerdict",
                            schemaPath:
                              "#/properties/completionVerdict/anyOf/1/type",
                            keyword: "type",
                            params: { type: "null" },
                            message: "must be null",
                          };
                          if (vErrors === null) {
                            vErrors = [err2];
                          } else {
                            vErrors.push(err2);
                          }
                          errors++;
                        }
                        var _valid0 = _errs20 === errors;
                        valid3 = valid3 || _valid0;
                        if (!valid3) {
                          const err3 = {
                            instancePath: instancePath + "/completionVerdict",
                            schemaPath: "#/properties/completionVerdict/anyOf",
                            keyword: "anyOf",
                            params: {},
                            message: "must match a schema in anyOf",
                          };
                          if (vErrors === null) {
                            vErrors = [err3];
                          } else {
                            vErrors.push(err3);
                          }
                          errors++;
                          validate26.errors = vErrors;
                          return false;
                        } else {
                          errors = _errs17;
                          if (vErrors !== null) {
                            if (_errs17) {
                              vErrors.length = _errs17;
                            } else {
                              vErrors = null;
                            }
                          }
                        }
                        var valid0 = _errs16 === errors;
                      } else {
                        var valid0 = true;
                      }
                      if (valid0) {
                        if (data.notationProfile !== undefined) {
                          const _errs22 = errors;
                          if (typeof data.notationProfile !== "string") {
                            validate26.errors = [
                              {
                                instancePath: instancePath + "/notationProfile",
                                schemaPath: "#/properties/notationProfile/type",
                                keyword: "type",
                                params: { type: "string" },
                                message: "must be string",
                              },
                            ];
                            return false;
                          }
                          var valid0 = _errs22 === errors;
                        } else {
                          var valid0 = true;
                        }
                        if (valid0) {
                          if (data.steps !== undefined) {
                            let data8 = data.steps;
                            const _errs24 = errors;
                            if (errors === _errs24) {
                              if (Array.isArray(data8)) {
                                var valid4 = true;
                                const len0 = data8.length;
                                for (let i0 = 0; i0 < len0; i0++) {
                                  const _errs26 = errors;
                                  if (
                                    !validate27(data8[i0], {
                                      instancePath:
                                        instancePath + "/steps/" + i0,
                                      parentData: data8,
                                      parentDataProperty: i0,
                                      rootData,
                                      dynamicAnchors,
                                    })
                                  ) {
                                    vErrors =
                                      vErrors === null
                                        ? validate27.errors
                                        : vErrors.concat(validate27.errors);
                                    errors = vErrors.length;
                                  }
                                  var valid4 = _errs26 === errors;
                                  if (!valid4) {
                                    break;
                                  }
                                }
                              } else {
                                validate26.errors = [
                                  {
                                    instancePath: instancePath + "/steps",
                                    schemaPath: "#/properties/steps/type",
                                    keyword: "type",
                                    params: { type: "array" },
                                    message: "must be array",
                                  },
                                ];
                                return false;
                              }
                            }
                            var valid0 = _errs24 === errors;
                          } else {
                            var valid0 = true;
                          }
                          if (valid0) {
                            if (data.openedAt !== undefined) {
                              let data10 = data.openedAt;
                              const _errs27 = errors;
                              if (errors === _errs27) {
                                if (errors === _errs27) {
                                  if (typeof data10 === "string") {
                                    if (!formats6.validate(data10)) {
                                      validate26.errors = [
                                        {
                                          instancePath:
                                            instancePath + "/openedAt",
                                          schemaPath:
                                            "#/properties/openedAt/format",
                                          keyword: "format",
                                          params: { format: "date-time" },
                                          message:
                                            'must match format "' +
                                            "date-time" +
                                            '"',
                                        },
                                      ];
                                      return false;
                                    }
                                  } else {
                                    validate26.errors = [
                                      {
                                        instancePath:
                                          instancePath + "/openedAt",
                                        schemaPath:
                                          "#/properties/openedAt/type",
                                        keyword: "type",
                                        params: { type: "string" },
                                        message: "must be string",
                                      },
                                    ];
                                    return false;
                                  }
                                }
                              }
                              var valid0 = _errs27 === errors;
                            } else {
                              var valid0 = true;
                            }
                            if (valid0) {
                              if (data.updatedAt !== undefined) {
                                let data11 = data.updatedAt;
                                const _errs29 = errors;
                                if (errors === _errs29) {
                                  if (errors === _errs29) {
                                    if (typeof data11 === "string") {
                                      if (!formats6.validate(data11)) {
                                        validate26.errors = [
                                          {
                                            instancePath:
                                              instancePath + "/updatedAt",
                                            schemaPath:
                                              "#/properties/updatedAt/format",
                                            keyword: "format",
                                            params: { format: "date-time" },
                                            message:
                                              'must match format "' +
                                              "date-time" +
                                              '"',
                                          },
                                        ];
                                        return false;
                                      }
                                    } else {
                                      validate26.errors = [
                                        {
                                          instancePath:
                                            instancePath + "/updatedAt",
                                          schemaPath:
                                            "#/properties/updatedAt/type",
                                          keyword: "type",
                                          params: { type: "string" },
                                          message: "must be string",
                                        },
                                      ];
                                      return false;
                                    }
                                  }
                                }
                                var valid0 = _errs29 === errors;
                              } else {
                                var valid0 = true;
                              }
                              if (valid0) {
                                if (data.parentEpisodeId !== undefined) {
                                  let data12 = data.parentEpisodeId;
                                  const _errs31 = errors;
                                  const _errs32 = errors;
                                  let valid5 = false;
                                  const _errs33 = errors;
                                  if (errors === _errs33) {
                                    if (errors === _errs33) {
                                      if (typeof data12 === "string") {
                                        if (!formats4.test(data12)) {
                                          const err4 = {
                                            instancePath:
                                              instancePath + "/parentEpisodeId",
                                            schemaPath:
                                              "#/properties/parentEpisodeId/anyOf/0/format",
                                            keyword: "format",
                                            params: { format: "uuid" },
                                            message:
                                              'must match format "' +
                                              "uuid" +
                                              '"',
                                          };
                                          if (vErrors === null) {
                                            vErrors = [err4];
                                          } else {
                                            vErrors.push(err4);
                                          }
                                          errors++;
                                        }
                                      } else {
                                        const err5 = {
                                          instancePath:
                                            instancePath + "/parentEpisodeId",
                                          schemaPath:
                                            "#/properties/parentEpisodeId/anyOf/0/type",
                                          keyword: "type",
                                          params: { type: "string" },
                                          message: "must be string",
                                        };
                                        if (vErrors === null) {
                                          vErrors = [err5];
                                        } else {
                                          vErrors.push(err5);
                                        }
                                        errors++;
                                      }
                                    }
                                  }
                                  var _valid1 = _errs33 === errors;
                                  valid5 = valid5 || _valid1;
                                  const _errs35 = errors;
                                  if (data12 !== null) {
                                    const err6 = {
                                      instancePath:
                                        instancePath + "/parentEpisodeId",
                                      schemaPath:
                                        "#/properties/parentEpisodeId/anyOf/1/type",
                                      keyword: "type",
                                      params: { type: "null" },
                                      message: "must be null",
                                    };
                                    if (vErrors === null) {
                                      vErrors = [err6];
                                    } else {
                                      vErrors.push(err6);
                                    }
                                    errors++;
                                  }
                                  var _valid1 = _errs35 === errors;
                                  valid5 = valid5 || _valid1;
                                  if (!valid5) {
                                    const err7 = {
                                      instancePath:
                                        instancePath + "/parentEpisodeId",
                                      schemaPath:
                                        "#/properties/parentEpisodeId/anyOf",
                                      keyword: "anyOf",
                                      params: {},
                                      message: "must match a schema in anyOf",
                                    };
                                    if (vErrors === null) {
                                      vErrors = [err7];
                                    } else {
                                      vErrors.push(err7);
                                    }
                                    errors++;
                                    validate26.errors = vErrors;
                                    return false;
                                  } else {
                                    errors = _errs32;
                                    if (vErrors !== null) {
                                      if (_errs32) {
                                        vErrors.length = _errs32;
                                      } else {
                                        vErrors = null;
                                      }
                                    }
                                  }
                                  var valid0 = _errs31 === errors;
                                } else {
                                  var valid0 = true;
                                }
                                if (valid0) {
                                  if (data.currentVerification !== undefined) {
                                    let data13 = data.currentVerification;
                                    const _errs37 = errors;
                                    const _errs38 = errors;
                                    let valid6 = false;
                                    const _errs39 = errors;
                                    if (
                                      !validate29(data13, {
                                        instancePath:
                                          instancePath + "/currentVerification",
                                        parentData: data,
                                        parentDataProperty:
                                          "currentVerification",
                                        rootData,
                                        dynamicAnchors,
                                      })
                                    ) {
                                      vErrors =
                                        vErrors === null
                                          ? validate29.errors
                                          : vErrors.concat(validate29.errors);
                                      errors = vErrors.length;
                                    }
                                    var _valid2 = _errs39 === errors;
                                    valid6 = valid6 || _valid2;
                                    const _errs40 = errors;
                                    if (data13 !== null) {
                                      const err8 = {
                                        instancePath:
                                          instancePath + "/currentVerification",
                                        schemaPath:
                                          "#/properties/currentVerification/anyOf/1/type",
                                        keyword: "type",
                                        params: { type: "null" },
                                        message: "must be null",
                                      };
                                      if (vErrors === null) {
                                        vErrors = [err8];
                                      } else {
                                        vErrors.push(err8);
                                      }
                                      errors++;
                                    }
                                    var _valid2 = _errs40 === errors;
                                    valid6 = valid6 || _valid2;
                                    if (!valid6) {
                                      const err9 = {
                                        instancePath:
                                          instancePath + "/currentVerification",
                                        schemaPath:
                                          "#/properties/currentVerification/anyOf",
                                        keyword: "anyOf",
                                        params: {},
                                        message: "must match a schema in anyOf",
                                      };
                                      if (vErrors === null) {
                                        vErrors = [err9];
                                      } else {
                                        vErrors.push(err9);
                                      }
                                      errors++;
                                      validate26.errors = vErrors;
                                      return false;
                                    } else {
                                      errors = _errs38;
                                      if (vErrors !== null) {
                                        if (_errs38) {
                                          vErrors.length = _errs38;
                                        } else {
                                          vErrors = null;
                                        }
                                      }
                                    }
                                    var valid0 = _errs37 === errors;
                                  } else {
                                    var valid0 = true;
                                  }
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    } else {
      validate26.errors = [
        {
          instancePath,
          schemaPath: "#/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        },
      ];
      return false;
    }
  }
  validate26.errors = vErrors;
  return errors === 0;
}
validate26.evaluated = {
  props: true,
  dynamicProps: false,
  dynamicItems: false,
};
function validate25(
  data,
  {
    instancePath = "",
    parentData,
    parentDataProperty,
    rootData = data,
    dynamicAnchors = {},
  } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate25.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (errors === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (
        (data.items === undefined && (missing0 = "items")) ||
        (data.nextCursor === undefined && (missing0 = "nextCursor"))
      ) {
        validate25.errors = [
          {
            instancePath,
            schemaPath: "#/required",
            keyword: "required",
            params: { missingProperty: missing0 },
            message: "must have required property '" + missing0 + "'",
          },
        ];
        return false;
      } else {
        const _errs1 = errors;
        for (const key0 in data) {
          if (!(key0 === "items" || key0 === "nextCursor")) {
            validate25.errors = [
              {
                instancePath,
                schemaPath: "#/additionalProperties",
                keyword: "additionalProperties",
                params: { additionalProperty: key0 },
                message: "must NOT have additional properties",
              },
            ];
            return false;
            break;
          }
        }
        if (_errs1 === errors) {
          if (data.items !== undefined) {
            let data0 = data.items;
            const _errs2 = errors;
            if (errors === _errs2) {
              if (Array.isArray(data0)) {
                var valid1 = true;
                const len0 = data0.length;
                for (let i0 = 0; i0 < len0; i0++) {
                  const _errs4 = errors;
                  if (
                    !validate26(data0[i0], {
                      instancePath: instancePath + "/items/" + i0,
                      parentData: data0,
                      parentDataProperty: i0,
                      rootData,
                      dynamicAnchors,
                    })
                  ) {
                    vErrors =
                      vErrors === null
                        ? validate26.errors
                        : vErrors.concat(validate26.errors);
                    errors = vErrors.length;
                  }
                  var valid1 = _errs4 === errors;
                  if (!valid1) {
                    break;
                  }
                }
              } else {
                validate25.errors = [
                  {
                    instancePath: instancePath + "/items",
                    schemaPath: "#/properties/items/type",
                    keyword: "type",
                    params: { type: "array" },
                    message: "must be array",
                  },
                ];
                return false;
              }
            }
            var valid0 = _errs2 === errors;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.nextCursor !== undefined) {
              let data2 = data.nextCursor;
              const _errs5 = errors;
              const _errs6 = errors;
              let valid2 = false;
              const _errs7 = errors;
              if (typeof data2 !== "string") {
                const err0 = {
                  instancePath: instancePath + "/nextCursor",
                  schemaPath: "#/properties/nextCursor/anyOf/0/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                if (vErrors === null) {
                  vErrors = [err0];
                } else {
                  vErrors.push(err0);
                }
                errors++;
              }
              var _valid0 = _errs7 === errors;
              valid2 = valid2 || _valid0;
              const _errs9 = errors;
              if (data2 !== null) {
                const err1 = {
                  instancePath: instancePath + "/nextCursor",
                  schemaPath: "#/properties/nextCursor/anyOf/1/type",
                  keyword: "type",
                  params: { type: "null" },
                  message: "must be null",
                };
                if (vErrors === null) {
                  vErrors = [err1];
                } else {
                  vErrors.push(err1);
                }
                errors++;
              }
              var _valid0 = _errs9 === errors;
              valid2 = valid2 || _valid0;
              if (!valid2) {
                const err2 = {
                  instancePath: instancePath + "/nextCursor",
                  schemaPath: "#/properties/nextCursor/anyOf",
                  keyword: "anyOf",
                  params: {},
                  message: "must match a schema in anyOf",
                };
                if (vErrors === null) {
                  vErrors = [err2];
                } else {
                  vErrors.push(err2);
                }
                errors++;
                validate25.errors = vErrors;
                return false;
              } else {
                errors = _errs6;
                if (vErrors !== null) {
                  if (_errs6) {
                    vErrors.length = _errs6;
                  } else {
                    vErrors = null;
                  }
                }
              }
              var valid0 = _errs5 === errors;
            } else {
              var valid0 = true;
            }
          }
        }
      }
    } else {
      validate25.errors = [
        {
          instancePath,
          schemaPath: "#/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        },
      ];
      return false;
    }
  }
  validate25.errors = vErrors;
  return errors === 0;
}
validate25.evaluated = {
  props: true,
  dynamicProps: false,
  dynamicItems: false,
};
function validate24(
  data,
  {
    instancePath = "",
    parentData,
    parentDataProperty,
    rootData = data,
    dynamicAnchors = {},
  } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate24.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (errors === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (
        (data.data === undefined && (missing0 = "data")) ||
        (data.meta === undefined && (missing0 = "meta"))
      ) {
        validate24.errors = [
          {
            instancePath,
            schemaPath: "#/required",
            keyword: "required",
            params: { missingProperty: missing0 },
            message: "must have required property '" + missing0 + "'",
          },
        ];
        return false;
      } else {
        const _errs1 = errors;
        for (const key0 in data) {
          if (!(key0 === "data" || key0 === "meta")) {
            validate24.errors = [
              {
                instancePath,
                schemaPath: "#/additionalProperties",
                keyword: "additionalProperties",
                params: { additionalProperty: key0 },
                message: "must NOT have additional properties",
              },
            ];
            return false;
            break;
          }
        }
        if (_errs1 === errors) {
          if (data.data !== undefined) {
            const _errs2 = errors;
            if (
              !validate25(data.data, {
                instancePath: instancePath + "/data",
                parentData: data,
                parentDataProperty: "data",
                rootData,
                dynamicAnchors,
              })
            ) {
              vErrors =
                vErrors === null
                  ? validate25.errors
                  : vErrors.concat(validate25.errors);
              errors = vErrors.length;
            }
            var valid0 = _errs2 === errors;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.meta !== undefined) {
              let data1 = data.meta;
              const _errs3 = errors;
              const _errs4 = errors;
              if (errors === _errs4) {
                if (
                  data1 &&
                  typeof data1 == "object" &&
                  !Array.isArray(data1)
                ) {
                  let missing1;
                  if (
                    (data1.requestId === undefined &&
                      (missing1 = "requestId")) ||
                    (data1.serverTime === undefined &&
                      (missing1 = "serverTime")) ||
                    (data1.apiVersion === undefined &&
                      (missing1 = "apiVersion"))
                  ) {
                    validate24.errors = [
                      {
                        instancePath: instancePath + "/meta",
                        schemaPath: "#/components/schemas/Meta/required",
                        keyword: "required",
                        params: { missingProperty: missing1 },
                        message:
                          "must have required property '" + missing1 + "'",
                      },
                    ];
                    return false;
                  } else {
                    const _errs6 = errors;
                    for (const key1 in data1) {
                      if (
                        !(
                          key1 === "requestId" ||
                          key1 === "serverTime" ||
                          key1 === "apiVersion"
                        )
                      ) {
                        validate24.errors = [
                          {
                            instancePath: instancePath + "/meta",
                            schemaPath:
                              "#/components/schemas/Meta/additionalProperties",
                            keyword: "additionalProperties",
                            params: { additionalProperty: key1 },
                            message: "must NOT have additional properties",
                          },
                        ];
                        return false;
                        break;
                      }
                    }
                    if (_errs6 === errors) {
                      if (data1.requestId !== undefined) {
                        let data2 = data1.requestId;
                        const _errs7 = errors;
                        if (errors === _errs7) {
                          if (errors === _errs7) {
                            if (typeof data2 === "string") {
                              if (!formats4.test(data2)) {
                                validate24.errors = [
                                  {
                                    instancePath:
                                      instancePath + "/meta/requestId",
                                    schemaPath:
                                      "#/components/schemas/Meta/properties/requestId/format",
                                    keyword: "format",
                                    params: { format: "uuid" },
                                    message:
                                      'must match format "' + "uuid" + '"',
                                  },
                                ];
                                return false;
                              }
                            } else {
                              validate24.errors = [
                                {
                                  instancePath:
                                    instancePath + "/meta/requestId",
                                  schemaPath:
                                    "#/components/schemas/Meta/properties/requestId/type",
                                  keyword: "type",
                                  params: { type: "string" },
                                  message: "must be string",
                                },
                              ];
                              return false;
                            }
                          }
                        }
                        var valid2 = _errs7 === errors;
                      } else {
                        var valid2 = true;
                      }
                      if (valid2) {
                        if (data1.serverTime !== undefined) {
                          let data3 = data1.serverTime;
                          const _errs9 = errors;
                          if (errors === _errs9) {
                            if (errors === _errs9) {
                              if (typeof data3 === "string") {
                                if (!formats6.validate(data3)) {
                                  validate24.errors = [
                                    {
                                      instancePath:
                                        instancePath + "/meta/serverTime",
                                      schemaPath:
                                        "#/components/schemas/Meta/properties/serverTime/format",
                                      keyword: "format",
                                      params: { format: "date-time" },
                                      message:
                                        'must match format "' +
                                        "date-time" +
                                        '"',
                                    },
                                  ];
                                  return false;
                                }
                              } else {
                                validate24.errors = [
                                  {
                                    instancePath:
                                      instancePath + "/meta/serverTime",
                                    schemaPath:
                                      "#/components/schemas/Meta/properties/serverTime/type",
                                    keyword: "type",
                                    params: { type: "string" },
                                    message: "must be string",
                                  },
                                ];
                                return false;
                              }
                            }
                          }
                          var valid2 = _errs9 === errors;
                        } else {
                          var valid2 = true;
                        }
                        if (valid2) {
                          if (data1.apiVersion !== undefined) {
                            const _errs11 = errors;
                            if (typeof data1.apiVersion !== "string") {
                              validate24.errors = [
                                {
                                  instancePath:
                                    instancePath + "/meta/apiVersion",
                                  schemaPath:
                                    "#/components/schemas/Meta/properties/apiVersion/type",
                                  keyword: "type",
                                  params: { type: "string" },
                                  message: "must be string",
                                },
                              ];
                              return false;
                            }
                            var valid2 = _errs11 === errors;
                          } else {
                            var valid2 = true;
                          }
                        }
                      }
                    }
                  }
                } else {
                  validate24.errors = [
                    {
                      instancePath: instancePath + "/meta",
                      schemaPath: "#/components/schemas/Meta/type",
                      keyword: "type",
                      params: { type: "object" },
                      message: "must be object",
                    },
                  ];
                  return false;
                }
              }
              var valid0 = _errs3 === errors;
            } else {
              var valid0 = true;
            }
          }
        }
      }
    } else {
      validate24.errors = [
        {
          instancePath,
          schemaPath: "#/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        },
      ];
      return false;
    }
  }
  validate24.errors = vErrors;
  return errors === 0;
}
validate24.evaluated = {
  props: true,
  dynamicProps: false,
  dynamicItems: false,
};
exports.TeacherExampleEnvelope = validate44;
const schema57 = {
  type: "object",
  additionalProperties: false,
  properties: {
    data: { $ref: "#/components/schemas/TeacherDemoExample" },
    meta: { $ref: "#/components/schemas/Meta" },
  },
  required: ["data", "meta"],
};
const schema58 = {
  type: "object",
  additionalProperties: false,
  properties: {
    id: { type: "string", format: "uuid" },
    isSynthetic: {
      type: "boolean",
      const: true,
      description: "بيانات تركيبية فقط",
    },
    datasetCode: { type: "string" },
    problem: { $ref: "#/components/schemas/ProblemDetail" },
    steps: { type: "array", items: { $ref: "#/components/schemas/Step" } },
    mathStatus: { $ref: "#/components/schemas/MathStatus" },
    diagnosis: {
      anyOf: [
        { $ref: "#/components/schemas/DiagnosisCandidate" },
        { type: "null" },
      ],
    },
    reviewNoteAr: { type: "string" },
  },
  required: [
    "id",
    "isSynthetic",
    "datasetCode",
    "problem",
    "steps",
    "mathStatus",
    "diagnosis",
    "reviewNoteAr",
  ],
};
const schema59 = {
  type: "object",
  additionalProperties: false,
  description:
    "لا تتضمن الحل المرجعي أو answer_spec أو بيانات الإجابة الصحيحة للطالب.",
  properties: {
    id: { type: "string", format: "uuid" },
    revisionId: { type: "string", format: "uuid" },
    versionNumber: { type: "integer", format: "int32", minimum: 1 },
    statementAr: { type: "string", description: "صياغة المسألة المعتمدة." },
    originalEquation: {
      type: "string",
      description: "المعادلة العربية الأصلية الموثقة.",
      example: "٢(س + ٣) = ١٠",
    },
    kind: { $ref: "#/components/schemas/ProblemKind" },
    primarySkillId: { type: "string", format: "uuid" },
    notationProfile: { type: "string" },
    difficultyBand: {
      type: "integer",
      format: "int32",
      minimum: 1,
      maximum: 5,
    },
    contentReleaseId: { type: "string", format: "uuid" },
  },
  required: [
    "id",
    "revisionId",
    "versionNumber",
    "statementAr",
    "originalEquation",
    "kind",
    "primarySkillId",
    "notationProfile",
    "difficultyBand",
    "contentReleaseId",
  ],
};
const schema60 = {
  type: "string",
  description: "نوع المسألة من نسخة المحتوى المنشورة.",
  enum: ["main", "remediation", "transfer", "diagnostic"],
};
function validate46(
  data,
  {
    instancePath = "",
    parentData,
    parentDataProperty,
    rootData = data,
    dynamicAnchors = {},
  } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate46.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (errors === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (
        (data.id === undefined && (missing0 = "id")) ||
        (data.revisionId === undefined && (missing0 = "revisionId")) ||
        (data.versionNumber === undefined && (missing0 = "versionNumber")) ||
        (data.statementAr === undefined && (missing0 = "statementAr")) ||
        (data.originalEquation === undefined &&
          (missing0 = "originalEquation")) ||
        (data.kind === undefined && (missing0 = "kind")) ||
        (data.primarySkillId === undefined && (missing0 = "primarySkillId")) ||
        (data.notationProfile === undefined &&
          (missing0 = "notationProfile")) ||
        (data.difficultyBand === undefined && (missing0 = "difficultyBand")) ||
        (data.contentReleaseId === undefined && (missing0 = "contentReleaseId"))
      ) {
        validate46.errors = [
          {
            instancePath,
            schemaPath: "#/required",
            keyword: "required",
            params: { missingProperty: missing0 },
            message: "must have required property '" + missing0 + "'",
          },
        ];
        return false;
      } else {
        const _errs1 = errors;
        for (const key0 in data) {
          if (!func1.call(schema59.properties, key0)) {
            validate46.errors = [
              {
                instancePath,
                schemaPath: "#/additionalProperties",
                keyword: "additionalProperties",
                params: { additionalProperty: key0 },
                message: "must NOT have additional properties",
              },
            ];
            return false;
            break;
          }
        }
        if (_errs1 === errors) {
          if (data.id !== undefined) {
            let data0 = data.id;
            const _errs2 = errors;
            if (errors === _errs2) {
              if (errors === _errs2) {
                if (typeof data0 === "string") {
                  if (!formats4.test(data0)) {
                    validate46.errors = [
                      {
                        instancePath: instancePath + "/id",
                        schemaPath: "#/properties/id/format",
                        keyword: "format",
                        params: { format: "uuid" },
                        message: 'must match format "' + "uuid" + '"',
                      },
                    ];
                    return false;
                  }
                } else {
                  validate46.errors = [
                    {
                      instancePath: instancePath + "/id",
                      schemaPath: "#/properties/id/type",
                      keyword: "type",
                      params: { type: "string" },
                      message: "must be string",
                    },
                  ];
                  return false;
                }
              }
            }
            var valid0 = _errs2 === errors;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.revisionId !== undefined) {
              let data1 = data.revisionId;
              const _errs4 = errors;
              if (errors === _errs4) {
                if (errors === _errs4) {
                  if (typeof data1 === "string") {
                    if (!formats4.test(data1)) {
                      validate46.errors = [
                        {
                          instancePath: instancePath + "/revisionId",
                          schemaPath: "#/properties/revisionId/format",
                          keyword: "format",
                          params: { format: "uuid" },
                          message: 'must match format "' + "uuid" + '"',
                        },
                      ];
                      return false;
                    }
                  } else {
                    validate46.errors = [
                      {
                        instancePath: instancePath + "/revisionId",
                        schemaPath: "#/properties/revisionId/type",
                        keyword: "type",
                        params: { type: "string" },
                        message: "must be string",
                      },
                    ];
                    return false;
                  }
                }
              }
              var valid0 = _errs4 === errors;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.versionNumber !== undefined) {
                let data2 = data.versionNumber;
                const _errs6 = errors;
                if (
                  !(typeof data2 == "number" && !(data2 % 1) && !isNaN(data2))
                ) {
                  validate46.errors = [
                    {
                      instancePath: instancePath + "/versionNumber",
                      schemaPath: "#/properties/versionNumber/type",
                      keyword: "type",
                      params: { type: "integer" },
                      message: "must be integer",
                    },
                  ];
                  return false;
                }
                if (errors === _errs6) {
                  if (typeof data2 == "number") {
                    if (data2 < 1 || isNaN(data2)) {
                      validate46.errors = [
                        {
                          instancePath: instancePath + "/versionNumber",
                          schemaPath: "#/properties/versionNumber/minimum",
                          keyword: "minimum",
                          params: { comparison: ">=", limit: 1 },
                          message: "must be >= 1",
                        },
                      ];
                      return false;
                    } else {
                      if (!formats0.validate(data2)) {
                        validate46.errors = [
                          {
                            instancePath: instancePath + "/versionNumber",
                            schemaPath: "#/properties/versionNumber/format",
                            keyword: "format",
                            params: { format: "int32" },
                            message: 'must match format "' + "int32" + '"',
                          },
                        ];
                        return false;
                      }
                    }
                  }
                }
                var valid0 = _errs6 === errors;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.statementAr !== undefined) {
                  const _errs8 = errors;
                  if (typeof data.statementAr !== "string") {
                    validate46.errors = [
                      {
                        instancePath: instancePath + "/statementAr",
                        schemaPath: "#/properties/statementAr/type",
                        keyword: "type",
                        params: { type: "string" },
                        message: "must be string",
                      },
                    ];
                    return false;
                  }
                  var valid0 = _errs8 === errors;
                } else {
                  var valid0 = true;
                }
                if (valid0) {
                  if (data.originalEquation !== undefined) {
                    const _errs10 = errors;
                    if (typeof data.originalEquation !== "string") {
                      validate46.errors = [
                        {
                          instancePath: instancePath + "/originalEquation",
                          schemaPath: "#/properties/originalEquation/type",
                          keyword: "type",
                          params: { type: "string" },
                          message: "must be string",
                        },
                      ];
                      return false;
                    }
                    var valid0 = _errs10 === errors;
                  } else {
                    var valid0 = true;
                  }
                  if (valid0) {
                    if (data.kind !== undefined) {
                      let data5 = data.kind;
                      const _errs12 = errors;
                      if (typeof data5 !== "string") {
                        validate46.errors = [
                          {
                            instancePath: instancePath + "/kind",
                            schemaPath: "#/components/schemas/ProblemKind/type",
                            keyword: "type",
                            params: { type: "string" },
                            message: "must be string",
                          },
                        ];
                        return false;
                      }
                      if (
                        !(
                          data5 === "main" ||
                          data5 === "remediation" ||
                          data5 === "transfer" ||
                          data5 === "diagnostic"
                        )
                      ) {
                        validate46.errors = [
                          {
                            instancePath: instancePath + "/kind",
                            schemaPath: "#/components/schemas/ProblemKind/enum",
                            keyword: "enum",
                            params: { allowedValues: schema60.enum },
                            message:
                              "must be equal to one of the allowed values",
                          },
                        ];
                        return false;
                      }
                      var valid0 = _errs12 === errors;
                    } else {
                      var valid0 = true;
                    }
                    if (valid0) {
                      if (data.primarySkillId !== undefined) {
                        let data6 = data.primarySkillId;
                        const _errs15 = errors;
                        if (errors === _errs15) {
                          if (errors === _errs15) {
                            if (typeof data6 === "string") {
                              if (!formats4.test(data6)) {
                                validate46.errors = [
                                  {
                                    instancePath:
                                      instancePath + "/primarySkillId",
                                    schemaPath:
                                      "#/properties/primarySkillId/format",
                                    keyword: "format",
                                    params: { format: "uuid" },
                                    message:
                                      'must match format "' + "uuid" + '"',
                                  },
                                ];
                                return false;
                              }
                            } else {
                              validate46.errors = [
                                {
                                  instancePath:
                                    instancePath + "/primarySkillId",
                                  schemaPath:
                                    "#/properties/primarySkillId/type",
                                  keyword: "type",
                                  params: { type: "string" },
                                  message: "must be string",
                                },
                              ];
                              return false;
                            }
                          }
                        }
                        var valid0 = _errs15 === errors;
                      } else {
                        var valid0 = true;
                      }
                      if (valid0) {
                        if (data.notationProfile !== undefined) {
                          const _errs17 = errors;
                          if (typeof data.notationProfile !== "string") {
                            validate46.errors = [
                              {
                                instancePath: instancePath + "/notationProfile",
                                schemaPath: "#/properties/notationProfile/type",
                                keyword: "type",
                                params: { type: "string" },
                                message: "must be string",
                              },
                            ];
                            return false;
                          }
                          var valid0 = _errs17 === errors;
                        } else {
                          var valid0 = true;
                        }
                        if (valid0) {
                          if (data.difficultyBand !== undefined) {
                            let data8 = data.difficultyBand;
                            const _errs19 = errors;
                            if (
                              !(
                                typeof data8 == "number" &&
                                !(data8 % 1) &&
                                !isNaN(data8)
                              )
                            ) {
                              validate46.errors = [
                                {
                                  instancePath:
                                    instancePath + "/difficultyBand",
                                  schemaPath:
                                    "#/properties/difficultyBand/type",
                                  keyword: "type",
                                  params: { type: "integer" },
                                  message: "must be integer",
                                },
                              ];
                              return false;
                            }
                            if (errors === _errs19) {
                              if (typeof data8 == "number") {
                                if (data8 > 5 || isNaN(data8)) {
                                  validate46.errors = [
                                    {
                                      instancePath:
                                        instancePath + "/difficultyBand",
                                      schemaPath:
                                        "#/properties/difficultyBand/maximum",
                                      keyword: "maximum",
                                      params: { comparison: "<=", limit: 5 },
                                      message: "must be <= 5",
                                    },
                                  ];
                                  return false;
                                } else {
                                  if (data8 < 1 || isNaN(data8)) {
                                    validate46.errors = [
                                      {
                                        instancePath:
                                          instancePath + "/difficultyBand",
                                        schemaPath:
                                          "#/properties/difficultyBand/minimum",
                                        keyword: "minimum",
                                        params: { comparison: ">=", limit: 1 },
                                        message: "must be >= 1",
                                      },
                                    ];
                                    return false;
                                  } else {
                                    if (!formats0.validate(data8)) {
                                      validate46.errors = [
                                        {
                                          instancePath:
                                            instancePath + "/difficultyBand",
                                          schemaPath:
                                            "#/properties/difficultyBand/format",
                                          keyword: "format",
                                          params: { format: "int32" },
                                          message:
                                            'must match format "' +
                                            "int32" +
                                            '"',
                                        },
                                      ];
                                      return false;
                                    }
                                  }
                                }
                              }
                            }
                            var valid0 = _errs19 === errors;
                          } else {
                            var valid0 = true;
                          }
                          if (valid0) {
                            if (data.contentReleaseId !== undefined) {
                              let data9 = data.contentReleaseId;
                              const _errs21 = errors;
                              if (errors === _errs21) {
                                if (errors === _errs21) {
                                  if (typeof data9 === "string") {
                                    if (!formats4.test(data9)) {
                                      validate46.errors = [
                                        {
                                          instancePath:
                                            instancePath + "/contentReleaseId",
                                          schemaPath:
                                            "#/properties/contentReleaseId/format",
                                          keyword: "format",
                                          params: { format: "uuid" },
                                          message:
                                            'must match format "' +
                                            "uuid" +
                                            '"',
                                        },
                                      ];
                                      return false;
                                    }
                                  } else {
                                    validate46.errors = [
                                      {
                                        instancePath:
                                          instancePath + "/contentReleaseId",
                                        schemaPath:
                                          "#/properties/contentReleaseId/type",
                                        keyword: "type",
                                        params: { type: "string" },
                                        message: "must be string",
                                      },
                                    ];
                                    return false;
                                  }
                                }
                              }
                              var valid0 = _errs21 === errors;
                            } else {
                              var valid0 = true;
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    } else {
      validate46.errors = [
        {
          instancePath,
          schemaPath: "#/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        },
      ];
      return false;
    }
  }
  validate46.errors = vErrors;
  return errors === 0;
}
validate46.evaluated = {
  props: true,
  dynamicProps: false,
  dynamicItems: false,
};
function validate45(
  data,
  {
    instancePath = "",
    parentData,
    parentDataProperty,
    rootData = data,
    dynamicAnchors = {},
  } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate45.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (errors === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (
        (data.id === undefined && (missing0 = "id")) ||
        (data.isSynthetic === undefined && (missing0 = "isSynthetic")) ||
        (data.datasetCode === undefined && (missing0 = "datasetCode")) ||
        (data.problem === undefined && (missing0 = "problem")) ||
        (data.steps === undefined && (missing0 = "steps")) ||
        (data.mathStatus === undefined && (missing0 = "mathStatus")) ||
        (data.diagnosis === undefined && (missing0 = "diagnosis")) ||
        (data.reviewNoteAr === undefined && (missing0 = "reviewNoteAr"))
      ) {
        validate45.errors = [
          {
            instancePath,
            schemaPath: "#/required",
            keyword: "required",
            params: { missingProperty: missing0 },
            message: "must have required property '" + missing0 + "'",
          },
        ];
        return false;
      } else {
        const _errs1 = errors;
        for (const key0 in data) {
          if (
            !(
              key0 === "id" ||
              key0 === "isSynthetic" ||
              key0 === "datasetCode" ||
              key0 === "problem" ||
              key0 === "steps" ||
              key0 === "mathStatus" ||
              key0 === "diagnosis" ||
              key0 === "reviewNoteAr"
            )
          ) {
            validate45.errors = [
              {
                instancePath,
                schemaPath: "#/additionalProperties",
                keyword: "additionalProperties",
                params: { additionalProperty: key0 },
                message: "must NOT have additional properties",
              },
            ];
            return false;
            break;
          }
        }
        if (_errs1 === errors) {
          if (data.id !== undefined) {
            let data0 = data.id;
            const _errs2 = errors;
            if (errors === _errs2) {
              if (errors === _errs2) {
                if (typeof data0 === "string") {
                  if (!formats4.test(data0)) {
                    validate45.errors = [
                      {
                        instancePath: instancePath + "/id",
                        schemaPath: "#/properties/id/format",
                        keyword: "format",
                        params: { format: "uuid" },
                        message: 'must match format "' + "uuid" + '"',
                      },
                    ];
                    return false;
                  }
                } else {
                  validate45.errors = [
                    {
                      instancePath: instancePath + "/id",
                      schemaPath: "#/properties/id/type",
                      keyword: "type",
                      params: { type: "string" },
                      message: "must be string",
                    },
                  ];
                  return false;
                }
              }
            }
            var valid0 = _errs2 === errors;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.isSynthetic !== undefined) {
              let data1 = data.isSynthetic;
              const _errs4 = errors;
              if (typeof data1 !== "boolean") {
                validate45.errors = [
                  {
                    instancePath: instancePath + "/isSynthetic",
                    schemaPath: "#/properties/isSynthetic/type",
                    keyword: "type",
                    params: { type: "boolean" },
                    message: "must be boolean",
                  },
                ];
                return false;
              }
              if (true !== data1) {
                validate45.errors = [
                  {
                    instancePath: instancePath + "/isSynthetic",
                    schemaPath: "#/properties/isSynthetic/const",
                    keyword: "const",
                    params: { allowedValue: true },
                    message: "must be equal to constant",
                  },
                ];
                return false;
              }
              var valid0 = _errs4 === errors;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.datasetCode !== undefined) {
                const _errs6 = errors;
                if (typeof data.datasetCode !== "string") {
                  validate45.errors = [
                    {
                      instancePath: instancePath + "/datasetCode",
                      schemaPath: "#/properties/datasetCode/type",
                      keyword: "type",
                      params: { type: "string" },
                      message: "must be string",
                    },
                  ];
                  return false;
                }
                var valid0 = _errs6 === errors;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.problem !== undefined) {
                  const _errs8 = errors;
                  if (
                    !validate46(data.problem, {
                      instancePath: instancePath + "/problem",
                      parentData: data,
                      parentDataProperty: "problem",
                      rootData,
                      dynamicAnchors,
                    })
                  ) {
                    vErrors =
                      vErrors === null
                        ? validate46.errors
                        : vErrors.concat(validate46.errors);
                    errors = vErrors.length;
                  }
                  var valid0 = _errs8 === errors;
                } else {
                  var valid0 = true;
                }
                if (valid0) {
                  if (data.steps !== undefined) {
                    let data4 = data.steps;
                    const _errs9 = errors;
                    if (errors === _errs9) {
                      if (Array.isArray(data4)) {
                        var valid1 = true;
                        const len0 = data4.length;
                        for (let i0 = 0; i0 < len0; i0++) {
                          const _errs11 = errors;
                          if (
                            !validate27(data4[i0], {
                              instancePath: instancePath + "/steps/" + i0,
                              parentData: data4,
                              parentDataProperty: i0,
                              rootData,
                              dynamicAnchors,
                            })
                          ) {
                            vErrors =
                              vErrors === null
                                ? validate27.errors
                                : vErrors.concat(validate27.errors);
                            errors = vErrors.length;
                          }
                          var valid1 = _errs11 === errors;
                          if (!valid1) {
                            break;
                          }
                        }
                      } else {
                        validate45.errors = [
                          {
                            instancePath: instancePath + "/steps",
                            schemaPath: "#/properties/steps/type",
                            keyword: "type",
                            params: { type: "array" },
                            message: "must be array",
                          },
                        ];
                        return false;
                      }
                    }
                    var valid0 = _errs9 === errors;
                  } else {
                    var valid0 = true;
                  }
                  if (valid0) {
                    if (data.mathStatus !== undefined) {
                      let data6 = data.mathStatus;
                      const _errs12 = errors;
                      if (typeof data6 !== "string") {
                        validate45.errors = [
                          {
                            instancePath: instancePath + "/mathStatus",
                            schemaPath: "#/components/schemas/MathStatus/type",
                            keyword: "type",
                            params: { type: "string" },
                            message: "must be string",
                          },
                        ];
                        return false;
                      }
                      if (
                        !(
                          data6 === "verified_valid" ||
                          data6 === "verified_invalid" ||
                          data6 === "syntax_error" ||
                          data6 === "unsupported" ||
                          data6 === "inconclusive" ||
                          data6 === "service_error"
                        )
                      ) {
                        validate45.errors = [
                          {
                            instancePath: instancePath + "/mathStatus",
                            schemaPath: "#/components/schemas/MathStatus/enum",
                            keyword: "enum",
                            params: { allowedValues: schema46.enum },
                            message:
                              "must be equal to one of the allowed values",
                          },
                        ];
                        return false;
                      }
                      var valid0 = _errs12 === errors;
                    } else {
                      var valid0 = true;
                    }
                    if (valid0) {
                      if (data.diagnosis !== undefined) {
                        let data7 = data.diagnosis;
                        const _errs15 = errors;
                        const _errs16 = errors;
                        let valid3 = false;
                        const _errs17 = errors;
                        if (
                          !validate39(data7, {
                            instancePath: instancePath + "/diagnosis",
                            parentData: data,
                            parentDataProperty: "diagnosis",
                            rootData,
                            dynamicAnchors,
                          })
                        ) {
                          vErrors =
                            vErrors === null
                              ? validate39.errors
                              : vErrors.concat(validate39.errors);
                          errors = vErrors.length;
                        }
                        var _valid0 = _errs17 === errors;
                        valid3 = valid3 || _valid0;
                        const _errs18 = errors;
                        if (data7 !== null) {
                          const err0 = {
                            instancePath: instancePath + "/diagnosis",
                            schemaPath: "#/properties/diagnosis/anyOf/1/type",
                            keyword: "type",
                            params: { type: "null" },
                            message: "must be null",
                          };
                          if (vErrors === null) {
                            vErrors = [err0];
                          } else {
                            vErrors.push(err0);
                          }
                          errors++;
                        }
                        var _valid0 = _errs18 === errors;
                        valid3 = valid3 || _valid0;
                        if (!valid3) {
                          const err1 = {
                            instancePath: instancePath + "/diagnosis",
                            schemaPath: "#/properties/diagnosis/anyOf",
                            keyword: "anyOf",
                            params: {},
                            message: "must match a schema in anyOf",
                          };
                          if (vErrors === null) {
                            vErrors = [err1];
                          } else {
                            vErrors.push(err1);
                          }
                          errors++;
                          validate45.errors = vErrors;
                          return false;
                        } else {
                          errors = _errs16;
                          if (vErrors !== null) {
                            if (_errs16) {
                              vErrors.length = _errs16;
                            } else {
                              vErrors = null;
                            }
                          }
                        }
                        var valid0 = _errs15 === errors;
                      } else {
                        var valid0 = true;
                      }
                      if (valid0) {
                        if (data.reviewNoteAr !== undefined) {
                          const _errs20 = errors;
                          if (typeof data.reviewNoteAr !== "string") {
                            validate45.errors = [
                              {
                                instancePath: instancePath + "/reviewNoteAr",
                                schemaPath: "#/properties/reviewNoteAr/type",
                                keyword: "type",
                                params: { type: "string" },
                                message: "must be string",
                              },
                            ];
                            return false;
                          }
                          var valid0 = _errs20 === errors;
                        } else {
                          var valid0 = true;
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    } else {
      validate45.errors = [
        {
          instancePath,
          schemaPath: "#/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        },
      ];
      return false;
    }
  }
  validate45.errors = vErrors;
  return errors === 0;
}
validate45.evaluated = {
  props: true,
  dynamicProps: false,
  dynamicItems: false,
};
function validate44(
  data,
  {
    instancePath = "",
    parentData,
    parentDataProperty,
    rootData = data,
    dynamicAnchors = {},
  } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate44.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (errors === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (
        (data.data === undefined && (missing0 = "data")) ||
        (data.meta === undefined && (missing0 = "meta"))
      ) {
        validate44.errors = [
          {
            instancePath,
            schemaPath: "#/required",
            keyword: "required",
            params: { missingProperty: missing0 },
            message: "must have required property '" + missing0 + "'",
          },
        ];
        return false;
      } else {
        const _errs1 = errors;
        for (const key0 in data) {
          if (!(key0 === "data" || key0 === "meta")) {
            validate44.errors = [
              {
                instancePath,
                schemaPath: "#/additionalProperties",
                keyword: "additionalProperties",
                params: { additionalProperty: key0 },
                message: "must NOT have additional properties",
              },
            ];
            return false;
            break;
          }
        }
        if (_errs1 === errors) {
          if (data.data !== undefined) {
            const _errs2 = errors;
            if (
              !validate45(data.data, {
                instancePath: instancePath + "/data",
                parentData: data,
                parentDataProperty: "data",
                rootData,
                dynamicAnchors,
              })
            ) {
              vErrors =
                vErrors === null
                  ? validate45.errors
                  : vErrors.concat(validate45.errors);
              errors = vErrors.length;
            }
            var valid0 = _errs2 === errors;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.meta !== undefined) {
              let data1 = data.meta;
              const _errs3 = errors;
              const _errs4 = errors;
              if (errors === _errs4) {
                if (
                  data1 &&
                  typeof data1 == "object" &&
                  !Array.isArray(data1)
                ) {
                  let missing1;
                  if (
                    (data1.requestId === undefined &&
                      (missing1 = "requestId")) ||
                    (data1.serverTime === undefined &&
                      (missing1 = "serverTime")) ||
                    (data1.apiVersion === undefined &&
                      (missing1 = "apiVersion"))
                  ) {
                    validate44.errors = [
                      {
                        instancePath: instancePath + "/meta",
                        schemaPath: "#/components/schemas/Meta/required",
                        keyword: "required",
                        params: { missingProperty: missing1 },
                        message:
                          "must have required property '" + missing1 + "'",
                      },
                    ];
                    return false;
                  } else {
                    const _errs6 = errors;
                    for (const key1 in data1) {
                      if (
                        !(
                          key1 === "requestId" ||
                          key1 === "serverTime" ||
                          key1 === "apiVersion"
                        )
                      ) {
                        validate44.errors = [
                          {
                            instancePath: instancePath + "/meta",
                            schemaPath:
                              "#/components/schemas/Meta/additionalProperties",
                            keyword: "additionalProperties",
                            params: { additionalProperty: key1 },
                            message: "must NOT have additional properties",
                          },
                        ];
                        return false;
                        break;
                      }
                    }
                    if (_errs6 === errors) {
                      if (data1.requestId !== undefined) {
                        let data2 = data1.requestId;
                        const _errs7 = errors;
                        if (errors === _errs7) {
                          if (errors === _errs7) {
                            if (typeof data2 === "string") {
                              if (!formats4.test(data2)) {
                                validate44.errors = [
                                  {
                                    instancePath:
                                      instancePath + "/meta/requestId",
                                    schemaPath:
                                      "#/components/schemas/Meta/properties/requestId/format",
                                    keyword: "format",
                                    params: { format: "uuid" },
                                    message:
                                      'must match format "' + "uuid" + '"',
                                  },
                                ];
                                return false;
                              }
                            } else {
                              validate44.errors = [
                                {
                                  instancePath:
                                    instancePath + "/meta/requestId",
                                  schemaPath:
                                    "#/components/schemas/Meta/properties/requestId/type",
                                  keyword: "type",
                                  params: { type: "string" },
                                  message: "must be string",
                                },
                              ];
                              return false;
                            }
                          }
                        }
                        var valid2 = _errs7 === errors;
                      } else {
                        var valid2 = true;
                      }
                      if (valid2) {
                        if (data1.serverTime !== undefined) {
                          let data3 = data1.serverTime;
                          const _errs9 = errors;
                          if (errors === _errs9) {
                            if (errors === _errs9) {
                              if (typeof data3 === "string") {
                                if (!formats6.validate(data3)) {
                                  validate44.errors = [
                                    {
                                      instancePath:
                                        instancePath + "/meta/serverTime",
                                      schemaPath:
                                        "#/components/schemas/Meta/properties/serverTime/format",
                                      keyword: "format",
                                      params: { format: "date-time" },
                                      message:
                                        'must match format "' +
                                        "date-time" +
                                        '"',
                                    },
                                  ];
                                  return false;
                                }
                              } else {
                                validate44.errors = [
                                  {
                                    instancePath:
                                      instancePath + "/meta/serverTime",
                                    schemaPath:
                                      "#/components/schemas/Meta/properties/serverTime/type",
                                    keyword: "type",
                                    params: { type: "string" },
                                    message: "must be string",
                                  },
                                ];
                                return false;
                              }
                            }
                          }
                          var valid2 = _errs9 === errors;
                        } else {
                          var valid2 = true;
                        }
                        if (valid2) {
                          if (data1.apiVersion !== undefined) {
                            const _errs11 = errors;
                            if (typeof data1.apiVersion !== "string") {
                              validate44.errors = [
                                {
                                  instancePath:
                                    instancePath + "/meta/apiVersion",
                                  schemaPath:
                                    "#/components/schemas/Meta/properties/apiVersion/type",
                                  keyword: "type",
                                  params: { type: "string" },
                                  message: "must be string",
                                },
                              ];
                              return false;
                            }
                            var valid2 = _errs11 === errors;
                          } else {
                            var valid2 = true;
                          }
                        }
                      }
                    }
                  }
                } else {
                  validate44.errors = [
                    {
                      instancePath: instancePath + "/meta",
                      schemaPath: "#/components/schemas/Meta/type",
                      keyword: "type",
                      params: { type: "object" },
                      message: "must be object",
                    },
                  ];
                  return false;
                }
              }
              var valid0 = _errs3 === errors;
            } else {
              var valid0 = true;
            }
          }
        }
      }
    } else {
      validate44.errors = [
        {
          instancePath,
          schemaPath: "#/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        },
      ];
      return false;
    }
  }
  validate44.errors = vErrors;
  return errors === 0;
}
validate44.evaluated = {
  props: true,
  dynamicProps: false,
  dynamicItems: false,
};
exports.TeacherSummaryEnvelope = validate51;
const schema63 = {
  type: "object",
  additionalProperties: false,
  properties: {
    data: { $ref: "#/components/schemas/TeacherDemoSummary" },
    meta: { $ref: "#/components/schemas/Meta" },
  },
  required: ["data", "meta"],
};
const schema64 = {
  type: "object",
  additionalProperties: false,
  properties: {
    isSynthetic: {
      type: "boolean",
      const: true,
      description: "ثابت true؛ ممنوع خلط بيانات الطلاب الحقيقية.",
      example: true,
    },
    datasetCode: { type: "string" },
    generatedAt: { type: "string", format: "date-time" },
    sampleStudentCount: { type: "integer", format: "int32", minimum: 0 },
    sampleAttemptCount: { type: "integer", format: "int32", minimum: 0 },
    metrics: {
      type: "array",
      items: { $ref: "#/components/schemas/TeacherDemoMetric" },
    },
    topMisconceptions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          errorCode: { type: "string" },
          nameAr: { type: "string" },
          count: { type: "integer", format: "int32", minimum: 0 },
        },
        required: ["errorCode", "nameAr", "count"],
      },
    },
    exampleIds: { type: "array", items: { type: "string", format: "uuid" } },
    disclaimerAr: { type: "string" },
  },
  required: [
    "isSynthetic",
    "datasetCode",
    "generatedAt",
    "sampleStudentCount",
    "sampleAttemptCount",
    "metrics",
    "topMisconceptions",
    "exampleIds",
    "disclaimerAr",
  ],
};
const schema65 = {
  type: "object",
  additionalProperties: false,
  properties: {
    code: { type: "string" },
    titleAr: { type: "string" },
    count: { type: "integer", format: "int32", minimum: 0 },
  },
  required: ["code", "titleAr", "count"],
};
function validate52(
  data,
  {
    instancePath = "",
    parentData,
    parentDataProperty,
    rootData = data,
    dynamicAnchors = {},
  } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate52.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (errors === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (
        (data.isSynthetic === undefined && (missing0 = "isSynthetic")) ||
        (data.datasetCode === undefined && (missing0 = "datasetCode")) ||
        (data.generatedAt === undefined && (missing0 = "generatedAt")) ||
        (data.sampleStudentCount === undefined &&
          (missing0 = "sampleStudentCount")) ||
        (data.sampleAttemptCount === undefined &&
          (missing0 = "sampleAttemptCount")) ||
        (data.metrics === undefined && (missing0 = "metrics")) ||
        (data.topMisconceptions === undefined &&
          (missing0 = "topMisconceptions")) ||
        (data.exampleIds === undefined && (missing0 = "exampleIds")) ||
        (data.disclaimerAr === undefined && (missing0 = "disclaimerAr"))
      ) {
        validate52.errors = [
          {
            instancePath,
            schemaPath: "#/required",
            keyword: "required",
            params: { missingProperty: missing0 },
            message: "must have required property '" + missing0 + "'",
          },
        ];
        return false;
      } else {
        const _errs1 = errors;
        for (const key0 in data) {
          if (!func1.call(schema64.properties, key0)) {
            validate52.errors = [
              {
                instancePath,
                schemaPath: "#/additionalProperties",
                keyword: "additionalProperties",
                params: { additionalProperty: key0 },
                message: "must NOT have additional properties",
              },
            ];
            return false;
            break;
          }
        }
        if (_errs1 === errors) {
          if (data.isSynthetic !== undefined) {
            let data0 = data.isSynthetic;
            const _errs2 = errors;
            if (typeof data0 !== "boolean") {
              validate52.errors = [
                {
                  instancePath: instancePath + "/isSynthetic",
                  schemaPath: "#/properties/isSynthetic/type",
                  keyword: "type",
                  params: { type: "boolean" },
                  message: "must be boolean",
                },
              ];
              return false;
            }
            if (true !== data0) {
              validate52.errors = [
                {
                  instancePath: instancePath + "/isSynthetic",
                  schemaPath: "#/properties/isSynthetic/const",
                  keyword: "const",
                  params: { allowedValue: true },
                  message: "must be equal to constant",
                },
              ];
              return false;
            }
            var valid0 = _errs2 === errors;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.datasetCode !== undefined) {
              const _errs4 = errors;
              if (typeof data.datasetCode !== "string") {
                validate52.errors = [
                  {
                    instancePath: instancePath + "/datasetCode",
                    schemaPath: "#/properties/datasetCode/type",
                    keyword: "type",
                    params: { type: "string" },
                    message: "must be string",
                  },
                ];
                return false;
              }
              var valid0 = _errs4 === errors;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.generatedAt !== undefined) {
                let data2 = data.generatedAt;
                const _errs6 = errors;
                if (errors === _errs6) {
                  if (errors === _errs6) {
                    if (typeof data2 === "string") {
                      if (!formats6.validate(data2)) {
                        validate52.errors = [
                          {
                            instancePath: instancePath + "/generatedAt",
                            schemaPath: "#/properties/generatedAt/format",
                            keyword: "format",
                            params: { format: "date-time" },
                            message: 'must match format "' + "date-time" + '"',
                          },
                        ];
                        return false;
                      }
                    } else {
                      validate52.errors = [
                        {
                          instancePath: instancePath + "/generatedAt",
                          schemaPath: "#/properties/generatedAt/type",
                          keyword: "type",
                          params: { type: "string" },
                          message: "must be string",
                        },
                      ];
                      return false;
                    }
                  }
                }
                var valid0 = _errs6 === errors;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.sampleStudentCount !== undefined) {
                  let data3 = data.sampleStudentCount;
                  const _errs8 = errors;
                  if (
                    !(typeof data3 == "number" && !(data3 % 1) && !isNaN(data3))
                  ) {
                    validate52.errors = [
                      {
                        instancePath: instancePath + "/sampleStudentCount",
                        schemaPath: "#/properties/sampleStudentCount/type",
                        keyword: "type",
                        params: { type: "integer" },
                        message: "must be integer",
                      },
                    ];
                    return false;
                  }
                  if (errors === _errs8) {
                    if (typeof data3 == "number") {
                      if (data3 < 0 || isNaN(data3)) {
                        validate52.errors = [
                          {
                            instancePath: instancePath + "/sampleStudentCount",
                            schemaPath:
                              "#/properties/sampleStudentCount/minimum",
                            keyword: "minimum",
                            params: { comparison: ">=", limit: 0 },
                            message: "must be >= 0",
                          },
                        ];
                        return false;
                      } else {
                        if (!formats0.validate(data3)) {
                          validate52.errors = [
                            {
                              instancePath:
                                instancePath + "/sampleStudentCount",
                              schemaPath:
                                "#/properties/sampleStudentCount/format",
                              keyword: "format",
                              params: { format: "int32" },
                              message: 'must match format "' + "int32" + '"',
                            },
                          ];
                          return false;
                        }
                      }
                    }
                  }
                  var valid0 = _errs8 === errors;
                } else {
                  var valid0 = true;
                }
                if (valid0) {
                  if (data.sampleAttemptCount !== undefined) {
                    let data4 = data.sampleAttemptCount;
                    const _errs10 = errors;
                    if (
                      !(
                        typeof data4 == "number" &&
                        !(data4 % 1) &&
                        !isNaN(data4)
                      )
                    ) {
                      validate52.errors = [
                        {
                          instancePath: instancePath + "/sampleAttemptCount",
                          schemaPath: "#/properties/sampleAttemptCount/type",
                          keyword: "type",
                          params: { type: "integer" },
                          message: "must be integer",
                        },
                      ];
                      return false;
                    }
                    if (errors === _errs10) {
                      if (typeof data4 == "number") {
                        if (data4 < 0 || isNaN(data4)) {
                          validate52.errors = [
                            {
                              instancePath:
                                instancePath + "/sampleAttemptCount",
                              schemaPath:
                                "#/properties/sampleAttemptCount/minimum",
                              keyword: "minimum",
                              params: { comparison: ">=", limit: 0 },
                              message: "must be >= 0",
                            },
                          ];
                          return false;
                        } else {
                          if (!formats0.validate(data4)) {
                            validate52.errors = [
                              {
                                instancePath:
                                  instancePath + "/sampleAttemptCount",
                                schemaPath:
                                  "#/properties/sampleAttemptCount/format",
                                keyword: "format",
                                params: { format: "int32" },
                                message: 'must match format "' + "int32" + '"',
                              },
                            ];
                            return false;
                          }
                        }
                      }
                    }
                    var valid0 = _errs10 === errors;
                  } else {
                    var valid0 = true;
                  }
                  if (valid0) {
                    if (data.metrics !== undefined) {
                      let data5 = data.metrics;
                      const _errs12 = errors;
                      if (errors === _errs12) {
                        if (Array.isArray(data5)) {
                          var valid1 = true;
                          const len0 = data5.length;
                          for (let i0 = 0; i0 < len0; i0++) {
                            let data6 = data5[i0];
                            const _errs14 = errors;
                            const _errs15 = errors;
                            if (errors === _errs15) {
                              if (
                                data6 &&
                                typeof data6 == "object" &&
                                !Array.isArray(data6)
                              ) {
                                let missing1;
                                if (
                                  (data6.code === undefined &&
                                    (missing1 = "code")) ||
                                  (data6.titleAr === undefined &&
                                    (missing1 = "titleAr")) ||
                                  (data6.count === undefined &&
                                    (missing1 = "count"))
                                ) {
                                  validate52.errors = [
                                    {
                                      instancePath:
                                        instancePath + "/metrics/" + i0,
                                      schemaPath:
                                        "#/components/schemas/TeacherDemoMetric/required",
                                      keyword: "required",
                                      params: { missingProperty: missing1 },
                                      message:
                                        "must have required property '" +
                                        missing1 +
                                        "'",
                                    },
                                  ];
                                  return false;
                                } else {
                                  const _errs17 = errors;
                                  for (const key1 in data6) {
                                    if (
                                      !(
                                        key1 === "code" ||
                                        key1 === "titleAr" ||
                                        key1 === "count"
                                      )
                                    ) {
                                      validate52.errors = [
                                        {
                                          instancePath:
                                            instancePath + "/metrics/" + i0,
                                          schemaPath:
                                            "#/components/schemas/TeacherDemoMetric/additionalProperties",
                                          keyword: "additionalProperties",
                                          params: { additionalProperty: key1 },
                                          message:
                                            "must NOT have additional properties",
                                        },
                                      ];
                                      return false;
                                      break;
                                    }
                                  }
                                  if (_errs17 === errors) {
                                    if (data6.code !== undefined) {
                                      const _errs18 = errors;
                                      if (typeof data6.code !== "string") {
                                        validate52.errors = [
                                          {
                                            instancePath:
                                              instancePath +
                                              "/metrics/" +
                                              i0 +
                                              "/code",
                                            schemaPath:
                                              "#/components/schemas/TeacherDemoMetric/properties/code/type",
                                            keyword: "type",
                                            params: { type: "string" },
                                            message: "must be string",
                                          },
                                        ];
                                        return false;
                                      }
                                      var valid3 = _errs18 === errors;
                                    } else {
                                      var valid3 = true;
                                    }
                                    if (valid3) {
                                      if (data6.titleAr !== undefined) {
                                        const _errs20 = errors;
                                        if (typeof data6.titleAr !== "string") {
                                          validate52.errors = [
                                            {
                                              instancePath:
                                                instancePath +
                                                "/metrics/" +
                                                i0 +
                                                "/titleAr",
                                              schemaPath:
                                                "#/components/schemas/TeacherDemoMetric/properties/titleAr/type",
                                              keyword: "type",
                                              params: { type: "string" },
                                              message: "must be string",
                                            },
                                          ];
                                          return false;
                                        }
                                        var valid3 = _errs20 === errors;
                                      } else {
                                        var valid3 = true;
                                      }
                                      if (valid3) {
                                        if (data6.count !== undefined) {
                                          let data9 = data6.count;
                                          const _errs22 = errors;
                                          if (
                                            !(
                                              typeof data9 == "number" &&
                                              !(data9 % 1) &&
                                              !isNaN(data9)
                                            )
                                          ) {
                                            validate52.errors = [
                                              {
                                                instancePath:
                                                  instancePath +
                                                  "/metrics/" +
                                                  i0 +
                                                  "/count",
                                                schemaPath:
                                                  "#/components/schemas/TeacherDemoMetric/properties/count/type",
                                                keyword: "type",
                                                params: { type: "integer" },
                                                message: "must be integer",
                                              },
                                            ];
                                            return false;
                                          }
                                          if (errors === _errs22) {
                                            if (typeof data9 == "number") {
                                              if (data9 < 0 || isNaN(data9)) {
                                                validate52.errors = [
                                                  {
                                                    instancePath:
                                                      instancePath +
                                                      "/metrics/" +
                                                      i0 +
                                                      "/count",
                                                    schemaPath:
                                                      "#/components/schemas/TeacherDemoMetric/properties/count/minimum",
                                                    keyword: "minimum",
                                                    params: {
                                                      comparison: ">=",
                                                      limit: 0,
                                                    },
                                                    message: "must be >= 0",
                                                  },
                                                ];
                                                return false;
                                              } else {
                                                if (!formats0.validate(data9)) {
                                                  validate52.errors = [
                                                    {
                                                      instancePath:
                                                        instancePath +
                                                        "/metrics/" +
                                                        i0 +
                                                        "/count",
                                                      schemaPath:
                                                        "#/components/schemas/TeacherDemoMetric/properties/count/format",
                                                      keyword: "format",
                                                      params: {
                                                        format: "int32",
                                                      },
                                                      message:
                                                        'must match format "' +
                                                        "int32" +
                                                        '"',
                                                    },
                                                  ];
                                                  return false;
                                                }
                                              }
                                            }
                                          }
                                          var valid3 = _errs22 === errors;
                                        } else {
                                          var valid3 = true;
                                        }
                                      }
                                    }
                                  }
                                }
                              } else {
                                validate52.errors = [
                                  {
                                    instancePath:
                                      instancePath + "/metrics/" + i0,
                                    schemaPath:
                                      "#/components/schemas/TeacherDemoMetric/type",
                                    keyword: "type",
                                    params: { type: "object" },
                                    message: "must be object",
                                  },
                                ];
                                return false;
                              }
                            }
                            var valid1 = _errs14 === errors;
                            if (!valid1) {
                              break;
                            }
                          }
                        } else {
                          validate52.errors = [
                            {
                              instancePath: instancePath + "/metrics",
                              schemaPath: "#/properties/metrics/type",
                              keyword: "type",
                              params: { type: "array" },
                              message: "must be array",
                            },
                          ];
                          return false;
                        }
                      }
                      var valid0 = _errs12 === errors;
                    } else {
                      var valid0 = true;
                    }
                    if (valid0) {
                      if (data.topMisconceptions !== undefined) {
                        let data10 = data.topMisconceptions;
                        const _errs24 = errors;
                        if (errors === _errs24) {
                          if (Array.isArray(data10)) {
                            var valid4 = true;
                            const len1 = data10.length;
                            for (let i1 = 0; i1 < len1; i1++) {
                              let data11 = data10[i1];
                              const _errs26 = errors;
                              if (errors === _errs26) {
                                if (
                                  data11 &&
                                  typeof data11 == "object" &&
                                  !Array.isArray(data11)
                                ) {
                                  let missing2;
                                  if (
                                    (data11.errorCode === undefined &&
                                      (missing2 = "errorCode")) ||
                                    (data11.nameAr === undefined &&
                                      (missing2 = "nameAr")) ||
                                    (data11.count === undefined &&
                                      (missing2 = "count"))
                                  ) {
                                    validate52.errors = [
                                      {
                                        instancePath:
                                          instancePath +
                                          "/topMisconceptions/" +
                                          i1,
                                        schemaPath:
                                          "#/properties/topMisconceptions/items/required",
                                        keyword: "required",
                                        params: { missingProperty: missing2 },
                                        message:
                                          "must have required property '" +
                                          missing2 +
                                          "'",
                                      },
                                    ];
                                    return false;
                                  } else {
                                    const _errs28 = errors;
                                    for (const key2 in data11) {
                                      if (
                                        !(
                                          key2 === "errorCode" ||
                                          key2 === "nameAr" ||
                                          key2 === "count"
                                        )
                                      ) {
                                        validate52.errors = [
                                          {
                                            instancePath:
                                              instancePath +
                                              "/topMisconceptions/" +
                                              i1,
                                            schemaPath:
                                              "#/properties/topMisconceptions/items/additionalProperties",
                                            keyword: "additionalProperties",
                                            params: {
                                              additionalProperty: key2,
                                            },
                                            message:
                                              "must NOT have additional properties",
                                          },
                                        ];
                                        return false;
                                        break;
                                      }
                                    }
                                    if (_errs28 === errors) {
                                      if (data11.errorCode !== undefined) {
                                        const _errs29 = errors;
                                        if (
                                          typeof data11.errorCode !== "string"
                                        ) {
                                          validate52.errors = [
                                            {
                                              instancePath:
                                                instancePath +
                                                "/topMisconceptions/" +
                                                i1 +
                                                "/errorCode",
                                              schemaPath:
                                                "#/properties/topMisconceptions/items/properties/errorCode/type",
                                              keyword: "type",
                                              params: { type: "string" },
                                              message: "must be string",
                                            },
                                          ];
                                          return false;
                                        }
                                        var valid5 = _errs29 === errors;
                                      } else {
                                        var valid5 = true;
                                      }
                                      if (valid5) {
                                        if (data11.nameAr !== undefined) {
                                          const _errs31 = errors;
                                          if (
                                            typeof data11.nameAr !== "string"
                                          ) {
                                            validate52.errors = [
                                              {
                                                instancePath:
                                                  instancePath +
                                                  "/topMisconceptions/" +
                                                  i1 +
                                                  "/nameAr",
                                                schemaPath:
                                                  "#/properties/topMisconceptions/items/properties/nameAr/type",
                                                keyword: "type",
                                                params: { type: "string" },
                                                message: "must be string",
                                              },
                                            ];
                                            return false;
                                          }
                                          var valid5 = _errs31 === errors;
                                        } else {
                                          var valid5 = true;
                                        }
                                        if (valid5) {
                                          if (data11.count !== undefined) {
                                            let data14 = data11.count;
                                            const _errs33 = errors;
                                            if (
                                              !(
                                                typeof data14 == "number" &&
                                                !(data14 % 1) &&
                                                !isNaN(data14)
                                              )
                                            ) {
                                              validate52.errors = [
                                                {
                                                  instancePath:
                                                    instancePath +
                                                    "/topMisconceptions/" +
                                                    i1 +
                                                    "/count",
                                                  schemaPath:
                                                    "#/properties/topMisconceptions/items/properties/count/type",
                                                  keyword: "type",
                                                  params: { type: "integer" },
                                                  message: "must be integer",
                                                },
                                              ];
                                              return false;
                                            }
                                            if (errors === _errs33) {
                                              if (typeof data14 == "number") {
                                                if (
                                                  data14 < 0 ||
                                                  isNaN(data14)
                                                ) {
                                                  validate52.errors = [
                                                    {
                                                      instancePath:
                                                        instancePath +
                                                        "/topMisconceptions/" +
                                                        i1 +
                                                        "/count",
                                                      schemaPath:
                                                        "#/properties/topMisconceptions/items/properties/count/minimum",
                                                      keyword: "minimum",
                                                      params: {
                                                        comparison: ">=",
                                                        limit: 0,
                                                      },
                                                      message: "must be >= 0",
                                                    },
                                                  ];
                                                  return false;
                                                } else {
                                                  if (
                                                    !formats0.validate(data14)
                                                  ) {
                                                    validate52.errors = [
                                                      {
                                                        instancePath:
                                                          instancePath +
                                                          "/topMisconceptions/" +
                                                          i1 +
                                                          "/count",
                                                        schemaPath:
                                                          "#/properties/topMisconceptions/items/properties/count/format",
                                                        keyword: "format",
                                                        params: {
                                                          format: "int32",
                                                        },
                                                        message:
                                                          'must match format "' +
                                                          "int32" +
                                                          '"',
                                                      },
                                                    ];
                                                    return false;
                                                  }
                                                }
                                              }
                                            }
                                            var valid5 = _errs33 === errors;
                                          } else {
                                            var valid5 = true;
                                          }
                                        }
                                      }
                                    }
                                  }
                                } else {
                                  validate52.errors = [
                                    {
                                      instancePath:
                                        instancePath +
                                        "/topMisconceptions/" +
                                        i1,
                                      schemaPath:
                                        "#/properties/topMisconceptions/items/type",
                                      keyword: "type",
                                      params: { type: "object" },
                                      message: "must be object",
                                    },
                                  ];
                                  return false;
                                }
                              }
                              var valid4 = _errs26 === errors;
                              if (!valid4) {
                                break;
                              }
                            }
                          } else {
                            validate52.errors = [
                              {
                                instancePath:
                                  instancePath + "/topMisconceptions",
                                schemaPath:
                                  "#/properties/topMisconceptions/type",
                                keyword: "type",
                                params: { type: "array" },
                                message: "must be array",
                              },
                            ];
                            return false;
                          }
                        }
                        var valid0 = _errs24 === errors;
                      } else {
                        var valid0 = true;
                      }
                      if (valid0) {
                        if (data.exampleIds !== undefined) {
                          let data15 = data.exampleIds;
                          const _errs35 = errors;
                          if (errors === _errs35) {
                            if (Array.isArray(data15)) {
                              var valid6 = true;
                              const len2 = data15.length;
                              for (let i2 = 0; i2 < len2; i2++) {
                                let data16 = data15[i2];
                                const _errs37 = errors;
                                if (errors === _errs37) {
                                  if (errors === _errs37) {
                                    if (typeof data16 === "string") {
                                      if (!formats4.test(data16)) {
                                        validate52.errors = [
                                          {
                                            instancePath:
                                              instancePath +
                                              "/exampleIds/" +
                                              i2,
                                            schemaPath:
                                              "#/properties/exampleIds/items/format",
                                            keyword: "format",
                                            params: { format: "uuid" },
                                            message:
                                              'must match format "' +
                                              "uuid" +
                                              '"',
                                          },
                                        ];
                                        return false;
                                      }
                                    } else {
                                      validate52.errors = [
                                        {
                                          instancePath:
                                            instancePath + "/exampleIds/" + i2,
                                          schemaPath:
                                            "#/properties/exampleIds/items/type",
                                          keyword: "type",
                                          params: { type: "string" },
                                          message: "must be string",
                                        },
                                      ];
                                      return false;
                                    }
                                  }
                                }
                                var valid6 = _errs37 === errors;
                                if (!valid6) {
                                  break;
                                }
                              }
                            } else {
                              validate52.errors = [
                                {
                                  instancePath: instancePath + "/exampleIds",
                                  schemaPath: "#/properties/exampleIds/type",
                                  keyword: "type",
                                  params: { type: "array" },
                                  message: "must be array",
                                },
                              ];
                              return false;
                            }
                          }
                          var valid0 = _errs35 === errors;
                        } else {
                          var valid0 = true;
                        }
                        if (valid0) {
                          if (data.disclaimerAr !== undefined) {
                            const _errs39 = errors;
                            if (typeof data.disclaimerAr !== "string") {
                              validate52.errors = [
                                {
                                  instancePath: instancePath + "/disclaimerAr",
                                  schemaPath: "#/properties/disclaimerAr/type",
                                  keyword: "type",
                                  params: { type: "string" },
                                  message: "must be string",
                                },
                              ];
                              return false;
                            }
                            var valid0 = _errs39 === errors;
                          } else {
                            var valid0 = true;
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    } else {
      validate52.errors = [
        {
          instancePath,
          schemaPath: "#/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        },
      ];
      return false;
    }
  }
  validate52.errors = vErrors;
  return errors === 0;
}
validate52.evaluated = {
  props: true,
  dynamicProps: false,
  dynamicItems: false,
};
function validate51(
  data,
  {
    instancePath = "",
    parentData,
    parentDataProperty,
    rootData = data,
    dynamicAnchors = {},
  } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate51.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (errors === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (
        (data.data === undefined && (missing0 = "data")) ||
        (data.meta === undefined && (missing0 = "meta"))
      ) {
        validate51.errors = [
          {
            instancePath,
            schemaPath: "#/required",
            keyword: "required",
            params: { missingProperty: missing0 },
            message: "must have required property '" + missing0 + "'",
          },
        ];
        return false;
      } else {
        const _errs1 = errors;
        for (const key0 in data) {
          if (!(key0 === "data" || key0 === "meta")) {
            validate51.errors = [
              {
                instancePath,
                schemaPath: "#/additionalProperties",
                keyword: "additionalProperties",
                params: { additionalProperty: key0 },
                message: "must NOT have additional properties",
              },
            ];
            return false;
            break;
          }
        }
        if (_errs1 === errors) {
          if (data.data !== undefined) {
            const _errs2 = errors;
            if (
              !validate52(data.data, {
                instancePath: instancePath + "/data",
                parentData: data,
                parentDataProperty: "data",
                rootData,
                dynamicAnchors,
              })
            ) {
              vErrors =
                vErrors === null
                  ? validate52.errors
                  : vErrors.concat(validate52.errors);
              errors = vErrors.length;
            }
            var valid0 = _errs2 === errors;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.meta !== undefined) {
              let data1 = data.meta;
              const _errs3 = errors;
              const _errs4 = errors;
              if (errors === _errs4) {
                if (
                  data1 &&
                  typeof data1 == "object" &&
                  !Array.isArray(data1)
                ) {
                  let missing1;
                  if (
                    (data1.requestId === undefined &&
                      (missing1 = "requestId")) ||
                    (data1.serverTime === undefined &&
                      (missing1 = "serverTime")) ||
                    (data1.apiVersion === undefined &&
                      (missing1 = "apiVersion"))
                  ) {
                    validate51.errors = [
                      {
                        instancePath: instancePath + "/meta",
                        schemaPath: "#/components/schemas/Meta/required",
                        keyword: "required",
                        params: { missingProperty: missing1 },
                        message:
                          "must have required property '" + missing1 + "'",
                      },
                    ];
                    return false;
                  } else {
                    const _errs6 = errors;
                    for (const key1 in data1) {
                      if (
                        !(
                          key1 === "requestId" ||
                          key1 === "serverTime" ||
                          key1 === "apiVersion"
                        )
                      ) {
                        validate51.errors = [
                          {
                            instancePath: instancePath + "/meta",
                            schemaPath:
                              "#/components/schemas/Meta/additionalProperties",
                            keyword: "additionalProperties",
                            params: { additionalProperty: key1 },
                            message: "must NOT have additional properties",
                          },
                        ];
                        return false;
                        break;
                      }
                    }
                    if (_errs6 === errors) {
                      if (data1.requestId !== undefined) {
                        let data2 = data1.requestId;
                        const _errs7 = errors;
                        if (errors === _errs7) {
                          if (errors === _errs7) {
                            if (typeof data2 === "string") {
                              if (!formats4.test(data2)) {
                                validate51.errors = [
                                  {
                                    instancePath:
                                      instancePath + "/meta/requestId",
                                    schemaPath:
                                      "#/components/schemas/Meta/properties/requestId/format",
                                    keyword: "format",
                                    params: { format: "uuid" },
                                    message:
                                      'must match format "' + "uuid" + '"',
                                  },
                                ];
                                return false;
                              }
                            } else {
                              validate51.errors = [
                                {
                                  instancePath:
                                    instancePath + "/meta/requestId",
                                  schemaPath:
                                    "#/components/schemas/Meta/properties/requestId/type",
                                  keyword: "type",
                                  params: { type: "string" },
                                  message: "must be string",
                                },
                              ];
                              return false;
                            }
                          }
                        }
                        var valid2 = _errs7 === errors;
                      } else {
                        var valid2 = true;
                      }
                      if (valid2) {
                        if (data1.serverTime !== undefined) {
                          let data3 = data1.serverTime;
                          const _errs9 = errors;
                          if (errors === _errs9) {
                            if (errors === _errs9) {
                              if (typeof data3 === "string") {
                                if (!formats6.validate(data3)) {
                                  validate51.errors = [
                                    {
                                      instancePath:
                                        instancePath + "/meta/serverTime",
                                      schemaPath:
                                        "#/components/schemas/Meta/properties/serverTime/format",
                                      keyword: "format",
                                      params: { format: "date-time" },
                                      message:
                                        'must match format "' +
                                        "date-time" +
                                        '"',
                                    },
                                  ];
                                  return false;
                                }
                              } else {
                                validate51.errors = [
                                  {
                                    instancePath:
                                      instancePath + "/meta/serverTime",
                                    schemaPath:
                                      "#/components/schemas/Meta/properties/serverTime/type",
                                    keyword: "type",
                                    params: { type: "string" },
                                    message: "must be string",
                                  },
                                ];
                                return false;
                              }
                            }
                          }
                          var valid2 = _errs9 === errors;
                        } else {
                          var valid2 = true;
                        }
                        if (valid2) {
                          if (data1.apiVersion !== undefined) {
                            const _errs11 = errors;
                            if (typeof data1.apiVersion !== "string") {
                              validate51.errors = [
                                {
                                  instancePath:
                                    instancePath + "/meta/apiVersion",
                                  schemaPath:
                                    "#/components/schemas/Meta/properties/apiVersion/type",
                                  keyword: "type",
                                  params: { type: "string" },
                                  message: "must be string",
                                },
                              ];
                              return false;
                            }
                            var valid2 = _errs11 === errors;
                          } else {
                            var valid2 = true;
                          }
                        }
                      }
                    }
                  }
                } else {
                  validate51.errors = [
                    {
                      instancePath: instancePath + "/meta",
                      schemaPath: "#/components/schemas/Meta/type",
                      keyword: "type",
                      params: { type: "object" },
                      message: "must be object",
                    },
                  ];
                  return false;
                }
              }
              var valid0 = _errs3 === errors;
            } else {
              var valid0 = true;
            }
          }
        }
      }
    } else {
      validate51.errors = [
        {
          instancePath,
          schemaPath: "#/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        },
      ];
      return false;
    }
  }
  validate51.errors = vErrors;
  return errors === 0;
}
validate51.evaluated = {
  props: true,
  dynamicProps: false,
  dynamicItems: false,
};
exports.SkillProgressEnvelope = validate54;
const schema67 = {
  type: "object",
  additionalProperties: false,
  properties: {
    data: { $ref: "#/components/schemas/SkillProgress" },
    meta: { $ref: "#/components/schemas/Meta" },
  },
  required: ["data", "meta"],
};
const schema68 = {
  type: "object",
  additionalProperties: false,
  properties: {
    skillId: { type: "string", format: "uuid" },
    skillCode: { type: "string" },
    titleAr: { type: "string" },
    state: { $ref: "#/components/schemas/ProgressState" },
    evidenceCount: { type: "integer", format: "int32", minimum: 0 },
    independentTransferCount: { type: "integer", format: "int32", minimum: 0 },
    assistedPracticeCount: { type: "integer", format: "int32", minimum: 0 },
    updatedAt: {
      anyOf: [{ type: "string", format: "date-time" }, { type: "null" }],
    },
  },
  required: [
    "skillId",
    "skillCode",
    "titleAr",
    "state",
    "evidenceCount",
    "independentTransferCount",
    "assistedPracticeCount",
    "updatedAt",
  ],
};
const schema69 = {
  type: "string",
  enum: [
    "not_assessed",
    "needs_followup",
    "practice_with_support",
    "new_evidence_of_understanding",
  ],
};
function validate55(
  data,
  {
    instancePath = "",
    parentData,
    parentDataProperty,
    rootData = data,
    dynamicAnchors = {},
  } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate55.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (errors === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (
        (data.skillId === undefined && (missing0 = "skillId")) ||
        (data.skillCode === undefined && (missing0 = "skillCode")) ||
        (data.titleAr === undefined && (missing0 = "titleAr")) ||
        (data.state === undefined && (missing0 = "state")) ||
        (data.evidenceCount === undefined && (missing0 = "evidenceCount")) ||
        (data.independentTransferCount === undefined &&
          (missing0 = "independentTransferCount")) ||
        (data.assistedPracticeCount === undefined &&
          (missing0 = "assistedPracticeCount")) ||
        (data.updatedAt === undefined && (missing0 = "updatedAt"))
      ) {
        validate55.errors = [
          {
            instancePath,
            schemaPath: "#/required",
            keyword: "required",
            params: { missingProperty: missing0 },
            message: "must have required property '" + missing0 + "'",
          },
        ];
        return false;
      } else {
        const _errs1 = errors;
        for (const key0 in data) {
          if (
            !(
              key0 === "skillId" ||
              key0 === "skillCode" ||
              key0 === "titleAr" ||
              key0 === "state" ||
              key0 === "evidenceCount" ||
              key0 === "independentTransferCount" ||
              key0 === "assistedPracticeCount" ||
              key0 === "updatedAt"
            )
          ) {
            validate55.errors = [
              {
                instancePath,
                schemaPath: "#/additionalProperties",
                keyword: "additionalProperties",
                params: { additionalProperty: key0 },
                message: "must NOT have additional properties",
              },
            ];
            return false;
            break;
          }
        }
        if (_errs1 === errors) {
          if (data.skillId !== undefined) {
            let data0 = data.skillId;
            const _errs2 = errors;
            if (errors === _errs2) {
              if (errors === _errs2) {
                if (typeof data0 === "string") {
                  if (!formats4.test(data0)) {
                    validate55.errors = [
                      {
                        instancePath: instancePath + "/skillId",
                        schemaPath: "#/properties/skillId/format",
                        keyword: "format",
                        params: { format: "uuid" },
                        message: 'must match format "' + "uuid" + '"',
                      },
                    ];
                    return false;
                  }
                } else {
                  validate55.errors = [
                    {
                      instancePath: instancePath + "/skillId",
                      schemaPath: "#/properties/skillId/type",
                      keyword: "type",
                      params: { type: "string" },
                      message: "must be string",
                    },
                  ];
                  return false;
                }
              }
            }
            var valid0 = _errs2 === errors;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.skillCode !== undefined) {
              const _errs4 = errors;
              if (typeof data.skillCode !== "string") {
                validate55.errors = [
                  {
                    instancePath: instancePath + "/skillCode",
                    schemaPath: "#/properties/skillCode/type",
                    keyword: "type",
                    params: { type: "string" },
                    message: "must be string",
                  },
                ];
                return false;
              }
              var valid0 = _errs4 === errors;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.titleAr !== undefined) {
                const _errs6 = errors;
                if (typeof data.titleAr !== "string") {
                  validate55.errors = [
                    {
                      instancePath: instancePath + "/titleAr",
                      schemaPath: "#/properties/titleAr/type",
                      keyword: "type",
                      params: { type: "string" },
                      message: "must be string",
                    },
                  ];
                  return false;
                }
                var valid0 = _errs6 === errors;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.state !== undefined) {
                  let data3 = data.state;
                  const _errs8 = errors;
                  if (typeof data3 !== "string") {
                    validate55.errors = [
                      {
                        instancePath: instancePath + "/state",
                        schemaPath: "#/components/schemas/ProgressState/type",
                        keyword: "type",
                        params: { type: "string" },
                        message: "must be string",
                      },
                    ];
                    return false;
                  }
                  if (
                    !(
                      data3 === "not_assessed" ||
                      data3 === "needs_followup" ||
                      data3 === "practice_with_support" ||
                      data3 === "new_evidence_of_understanding"
                    )
                  ) {
                    validate55.errors = [
                      {
                        instancePath: instancePath + "/state",
                        schemaPath: "#/components/schemas/ProgressState/enum",
                        keyword: "enum",
                        params: { allowedValues: schema69.enum },
                        message: "must be equal to one of the allowed values",
                      },
                    ];
                    return false;
                  }
                  var valid0 = _errs8 === errors;
                } else {
                  var valid0 = true;
                }
                if (valid0) {
                  if (data.evidenceCount !== undefined) {
                    let data4 = data.evidenceCount;
                    const _errs11 = errors;
                    if (
                      !(
                        typeof data4 == "number" &&
                        !(data4 % 1) &&
                        !isNaN(data4)
                      )
                    ) {
                      validate55.errors = [
                        {
                          instancePath: instancePath + "/evidenceCount",
                          schemaPath: "#/properties/evidenceCount/type",
                          keyword: "type",
                          params: { type: "integer" },
                          message: "must be integer",
                        },
                      ];
                      return false;
                    }
                    if (errors === _errs11) {
                      if (typeof data4 == "number") {
                        if (data4 < 0 || isNaN(data4)) {
                          validate55.errors = [
                            {
                              instancePath: instancePath + "/evidenceCount",
                              schemaPath: "#/properties/evidenceCount/minimum",
                              keyword: "minimum",
                              params: { comparison: ">=", limit: 0 },
                              message: "must be >= 0",
                            },
                          ];
                          return false;
                        } else {
                          if (!formats0.validate(data4)) {
                            validate55.errors = [
                              {
                                instancePath: instancePath + "/evidenceCount",
                                schemaPath: "#/properties/evidenceCount/format",
                                keyword: "format",
                                params: { format: "int32" },
                                message: 'must match format "' + "int32" + '"',
                              },
                            ];
                            return false;
                          }
                        }
                      }
                    }
                    var valid0 = _errs11 === errors;
                  } else {
                    var valid0 = true;
                  }
                  if (valid0) {
                    if (data.independentTransferCount !== undefined) {
                      let data5 = data.independentTransferCount;
                      const _errs13 = errors;
                      if (
                        !(
                          typeof data5 == "number" &&
                          !(data5 % 1) &&
                          !isNaN(data5)
                        )
                      ) {
                        validate55.errors = [
                          {
                            instancePath:
                              instancePath + "/independentTransferCount",
                            schemaPath:
                              "#/properties/independentTransferCount/type",
                            keyword: "type",
                            params: { type: "integer" },
                            message: "must be integer",
                          },
                        ];
                        return false;
                      }
                      if (errors === _errs13) {
                        if (typeof data5 == "number") {
                          if (data5 < 0 || isNaN(data5)) {
                            validate55.errors = [
                              {
                                instancePath:
                                  instancePath + "/independentTransferCount",
                                schemaPath:
                                  "#/properties/independentTransferCount/minimum",
                                keyword: "minimum",
                                params: { comparison: ">=", limit: 0 },
                                message: "must be >= 0",
                              },
                            ];
                            return false;
                          } else {
                            if (!formats0.validate(data5)) {
                              validate55.errors = [
                                {
                                  instancePath:
                                    instancePath + "/independentTransferCount",
                                  schemaPath:
                                    "#/properties/independentTransferCount/format",
                                  keyword: "format",
                                  params: { format: "int32" },
                                  message:
                                    'must match format "' + "int32" + '"',
                                },
                              ];
                              return false;
                            }
                          }
                        }
                      }
                      var valid0 = _errs13 === errors;
                    } else {
                      var valid0 = true;
                    }
                    if (valid0) {
                      if (data.assistedPracticeCount !== undefined) {
                        let data6 = data.assistedPracticeCount;
                        const _errs15 = errors;
                        if (
                          !(
                            typeof data6 == "number" &&
                            !(data6 % 1) &&
                            !isNaN(data6)
                          )
                        ) {
                          validate55.errors = [
                            {
                              instancePath:
                                instancePath + "/assistedPracticeCount",
                              schemaPath:
                                "#/properties/assistedPracticeCount/type",
                              keyword: "type",
                              params: { type: "integer" },
                              message: "must be integer",
                            },
                          ];
                          return false;
                        }
                        if (errors === _errs15) {
                          if (typeof data6 == "number") {
                            if (data6 < 0 || isNaN(data6)) {
                              validate55.errors = [
                                {
                                  instancePath:
                                    instancePath + "/assistedPracticeCount",
                                  schemaPath:
                                    "#/properties/assistedPracticeCount/minimum",
                                  keyword: "minimum",
                                  params: { comparison: ">=", limit: 0 },
                                  message: "must be >= 0",
                                },
                              ];
                              return false;
                            } else {
                              if (!formats0.validate(data6)) {
                                validate55.errors = [
                                  {
                                    instancePath:
                                      instancePath + "/assistedPracticeCount",
                                    schemaPath:
                                      "#/properties/assistedPracticeCount/format",
                                    keyword: "format",
                                    params: { format: "int32" },
                                    message:
                                      'must match format "' + "int32" + '"',
                                  },
                                ];
                                return false;
                              }
                            }
                          }
                        }
                        var valid0 = _errs15 === errors;
                      } else {
                        var valid0 = true;
                      }
                      if (valid0) {
                        if (data.updatedAt !== undefined) {
                          let data7 = data.updatedAt;
                          const _errs17 = errors;
                          const _errs18 = errors;
                          let valid2 = false;
                          const _errs19 = errors;
                          if (errors === _errs19) {
                            if (errors === _errs19) {
                              if (typeof data7 === "string") {
                                if (!formats6.validate(data7)) {
                                  const err0 = {
                                    instancePath: instancePath + "/updatedAt",
                                    schemaPath:
                                      "#/properties/updatedAt/anyOf/0/format",
                                    keyword: "format",
                                    params: { format: "date-time" },
                                    message:
                                      'must match format "' + "date-time" + '"',
                                  };
                                  if (vErrors === null) {
                                    vErrors = [err0];
                                  } else {
                                    vErrors.push(err0);
                                  }
                                  errors++;
                                }
                              } else {
                                const err1 = {
                                  instancePath: instancePath + "/updatedAt",
                                  schemaPath:
                                    "#/properties/updatedAt/anyOf/0/type",
                                  keyword: "type",
                                  params: { type: "string" },
                                  message: "must be string",
                                };
                                if (vErrors === null) {
                                  vErrors = [err1];
                                } else {
                                  vErrors.push(err1);
                                }
                                errors++;
                              }
                            }
                          }
                          var _valid0 = _errs19 === errors;
                          valid2 = valid2 || _valid0;
                          const _errs21 = errors;
                          if (data7 !== null) {
                            const err2 = {
                              instancePath: instancePath + "/updatedAt",
                              schemaPath: "#/properties/updatedAt/anyOf/1/type",
                              keyword: "type",
                              params: { type: "null" },
                              message: "must be null",
                            };
                            if (vErrors === null) {
                              vErrors = [err2];
                            } else {
                              vErrors.push(err2);
                            }
                            errors++;
                          }
                          var _valid0 = _errs21 === errors;
                          valid2 = valid2 || _valid0;
                          if (!valid2) {
                            const err3 = {
                              instancePath: instancePath + "/updatedAt",
                              schemaPath: "#/properties/updatedAt/anyOf",
                              keyword: "anyOf",
                              params: {},
                              message: "must match a schema in anyOf",
                            };
                            if (vErrors === null) {
                              vErrors = [err3];
                            } else {
                              vErrors.push(err3);
                            }
                            errors++;
                            validate55.errors = vErrors;
                            return false;
                          } else {
                            errors = _errs18;
                            if (vErrors !== null) {
                              if (_errs18) {
                                vErrors.length = _errs18;
                              } else {
                                vErrors = null;
                              }
                            }
                          }
                          var valid0 = _errs17 === errors;
                        } else {
                          var valid0 = true;
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    } else {
      validate55.errors = [
        {
          instancePath,
          schemaPath: "#/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        },
      ];
      return false;
    }
  }
  validate55.errors = vErrors;
  return errors === 0;
}
validate55.evaluated = {
  props: true,
  dynamicProps: false,
  dynamicItems: false,
};
function validate54(
  data,
  {
    instancePath = "",
    parentData,
    parentDataProperty,
    rootData = data,
    dynamicAnchors = {},
  } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate54.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (errors === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (
        (data.data === undefined && (missing0 = "data")) ||
        (data.meta === undefined && (missing0 = "meta"))
      ) {
        validate54.errors = [
          {
            instancePath,
            schemaPath: "#/required",
            keyword: "required",
            params: { missingProperty: missing0 },
            message: "must have required property '" + missing0 + "'",
          },
        ];
        return false;
      } else {
        const _errs1 = errors;
        for (const key0 in data) {
          if (!(key0 === "data" || key0 === "meta")) {
            validate54.errors = [
              {
                instancePath,
                schemaPath: "#/additionalProperties",
                keyword: "additionalProperties",
                params: { additionalProperty: key0 },
                message: "must NOT have additional properties",
              },
            ];
            return false;
            break;
          }
        }
        if (_errs1 === errors) {
          if (data.data !== undefined) {
            const _errs2 = errors;
            if (
              !validate55(data.data, {
                instancePath: instancePath + "/data",
                parentData: data,
                parentDataProperty: "data",
                rootData,
                dynamicAnchors,
              })
            ) {
              vErrors =
                vErrors === null
                  ? validate55.errors
                  : vErrors.concat(validate55.errors);
              errors = vErrors.length;
            }
            var valid0 = _errs2 === errors;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.meta !== undefined) {
              let data1 = data.meta;
              const _errs3 = errors;
              const _errs4 = errors;
              if (errors === _errs4) {
                if (
                  data1 &&
                  typeof data1 == "object" &&
                  !Array.isArray(data1)
                ) {
                  let missing1;
                  if (
                    (data1.requestId === undefined &&
                      (missing1 = "requestId")) ||
                    (data1.serverTime === undefined &&
                      (missing1 = "serverTime")) ||
                    (data1.apiVersion === undefined &&
                      (missing1 = "apiVersion"))
                  ) {
                    validate54.errors = [
                      {
                        instancePath: instancePath + "/meta",
                        schemaPath: "#/components/schemas/Meta/required",
                        keyword: "required",
                        params: { missingProperty: missing1 },
                        message:
                          "must have required property '" + missing1 + "'",
                      },
                    ];
                    return false;
                  } else {
                    const _errs6 = errors;
                    for (const key1 in data1) {
                      if (
                        !(
                          key1 === "requestId" ||
                          key1 === "serverTime" ||
                          key1 === "apiVersion"
                        )
                      ) {
                        validate54.errors = [
                          {
                            instancePath: instancePath + "/meta",
                            schemaPath:
                              "#/components/schemas/Meta/additionalProperties",
                            keyword: "additionalProperties",
                            params: { additionalProperty: key1 },
                            message: "must NOT have additional properties",
                          },
                        ];
                        return false;
                        break;
                      }
                    }
                    if (_errs6 === errors) {
                      if (data1.requestId !== undefined) {
                        let data2 = data1.requestId;
                        const _errs7 = errors;
                        if (errors === _errs7) {
                          if (errors === _errs7) {
                            if (typeof data2 === "string") {
                              if (!formats4.test(data2)) {
                                validate54.errors = [
                                  {
                                    instancePath:
                                      instancePath + "/meta/requestId",
                                    schemaPath:
                                      "#/components/schemas/Meta/properties/requestId/format",
                                    keyword: "format",
                                    params: { format: "uuid" },
                                    message:
                                      'must match format "' + "uuid" + '"',
                                  },
                                ];
                                return false;
                              }
                            } else {
                              validate54.errors = [
                                {
                                  instancePath:
                                    instancePath + "/meta/requestId",
                                  schemaPath:
                                    "#/components/schemas/Meta/properties/requestId/type",
                                  keyword: "type",
                                  params: { type: "string" },
                                  message: "must be string",
                                },
                              ];
                              return false;
                            }
                          }
                        }
                        var valid2 = _errs7 === errors;
                      } else {
                        var valid2 = true;
                      }
                      if (valid2) {
                        if (data1.serverTime !== undefined) {
                          let data3 = data1.serverTime;
                          const _errs9 = errors;
                          if (errors === _errs9) {
                            if (errors === _errs9) {
                              if (typeof data3 === "string") {
                                if (!formats6.validate(data3)) {
                                  validate54.errors = [
                                    {
                                      instancePath:
                                        instancePath + "/meta/serverTime",
                                      schemaPath:
                                        "#/components/schemas/Meta/properties/serverTime/format",
                                      keyword: "format",
                                      params: { format: "date-time" },
                                      message:
                                        'must match format "' +
                                        "date-time" +
                                        '"',
                                    },
                                  ];
                                  return false;
                                }
                              } else {
                                validate54.errors = [
                                  {
                                    instancePath:
                                      instancePath + "/meta/serverTime",
                                    schemaPath:
                                      "#/components/schemas/Meta/properties/serverTime/type",
                                    keyword: "type",
                                    params: { type: "string" },
                                    message: "must be string",
                                  },
                                ];
                                return false;
                              }
                            }
                          }
                          var valid2 = _errs9 === errors;
                        } else {
                          var valid2 = true;
                        }
                        if (valid2) {
                          if (data1.apiVersion !== undefined) {
                            const _errs11 = errors;
                            if (typeof data1.apiVersion !== "string") {
                              validate54.errors = [
                                {
                                  instancePath:
                                    instancePath + "/meta/apiVersion",
                                  schemaPath:
                                    "#/components/schemas/Meta/properties/apiVersion/type",
                                  keyword: "type",
                                  params: { type: "string" },
                                  message: "must be string",
                                },
                              ];
                              return false;
                            }
                            var valid2 = _errs11 === errors;
                          } else {
                            var valid2 = true;
                          }
                        }
                      }
                    }
                  }
                } else {
                  validate54.errors = [
                    {
                      instancePath: instancePath + "/meta",
                      schemaPath: "#/components/schemas/Meta/type",
                      keyword: "type",
                      params: { type: "object" },
                      message: "must be object",
                    },
                  ];
                  return false;
                }
              }
              var valid0 = _errs3 === errors;
            } else {
              var valid0 = true;
            }
          }
        }
      }
    } else {
      validate54.errors = [
        {
          instancePath,
          schemaPath: "#/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        },
      ];
      return false;
    }
  }
  validate54.errors = vErrors;
  return errors === 0;
}
validate54.evaluated = {
  props: true,
  dynamicProps: false,
  dynamicItems: false,
};
exports.ProgressEnvelope = validate57;
const schema71 = {
  type: "object",
  additionalProperties: false,
  properties: {
    data: { $ref: "#/components/schemas/ProgressSummary" },
    meta: { $ref: "#/components/schemas/Meta" },
  },
  required: ["data", "meta"],
};
const schema72 = {
  type: "object",
  additionalProperties: false,
  properties: {
    learningSessionId: { type: "string", format: "uuid" },
    isSynthetic: { type: "boolean" },
    skills: {
      type: "array",
      items: { $ref: "#/components/schemas/SkillProgress" },
    },
    updatedAt: { type: "string", format: "date-time" },
    noteAr: {
      type: "string",
      description: "نتائج دليل محدود، ليست شهادة إتقان نهائي.",
    },
  },
  required: [
    "learningSessionId",
    "isSynthetic",
    "skills",
    "updatedAt",
    "noteAr",
  ],
};
function validate58(
  data,
  {
    instancePath = "",
    parentData,
    parentDataProperty,
    rootData = data,
    dynamicAnchors = {},
  } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate58.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (errors === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (
        (data.learningSessionId === undefined &&
          (missing0 = "learningSessionId")) ||
        (data.isSynthetic === undefined && (missing0 = "isSynthetic")) ||
        (data.skills === undefined && (missing0 = "skills")) ||
        (data.updatedAt === undefined && (missing0 = "updatedAt")) ||
        (data.noteAr === undefined && (missing0 = "noteAr"))
      ) {
        validate58.errors = [
          {
            instancePath,
            schemaPath: "#/required",
            keyword: "required",
            params: { missingProperty: missing0 },
            message: "must have required property '" + missing0 + "'",
          },
        ];
        return false;
      } else {
        const _errs1 = errors;
        for (const key0 in data) {
          if (
            !(
              key0 === "learningSessionId" ||
              key0 === "isSynthetic" ||
              key0 === "skills" ||
              key0 === "updatedAt" ||
              key0 === "noteAr"
            )
          ) {
            validate58.errors = [
              {
                instancePath,
                schemaPath: "#/additionalProperties",
                keyword: "additionalProperties",
                params: { additionalProperty: key0 },
                message: "must NOT have additional properties",
              },
            ];
            return false;
            break;
          }
        }
        if (_errs1 === errors) {
          if (data.learningSessionId !== undefined) {
            let data0 = data.learningSessionId;
            const _errs2 = errors;
            if (errors === _errs2) {
              if (errors === _errs2) {
                if (typeof data0 === "string") {
                  if (!formats4.test(data0)) {
                    validate58.errors = [
                      {
                        instancePath: instancePath + "/learningSessionId",
                        schemaPath: "#/properties/learningSessionId/format",
                        keyword: "format",
                        params: { format: "uuid" },
                        message: 'must match format "' + "uuid" + '"',
                      },
                    ];
                    return false;
                  }
                } else {
                  validate58.errors = [
                    {
                      instancePath: instancePath + "/learningSessionId",
                      schemaPath: "#/properties/learningSessionId/type",
                      keyword: "type",
                      params: { type: "string" },
                      message: "must be string",
                    },
                  ];
                  return false;
                }
              }
            }
            var valid0 = _errs2 === errors;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.isSynthetic !== undefined) {
              const _errs4 = errors;
              if (typeof data.isSynthetic !== "boolean") {
                validate58.errors = [
                  {
                    instancePath: instancePath + "/isSynthetic",
                    schemaPath: "#/properties/isSynthetic/type",
                    keyword: "type",
                    params: { type: "boolean" },
                    message: "must be boolean",
                  },
                ];
                return false;
              }
              var valid0 = _errs4 === errors;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.skills !== undefined) {
                let data2 = data.skills;
                const _errs6 = errors;
                if (errors === _errs6) {
                  if (Array.isArray(data2)) {
                    var valid1 = true;
                    const len0 = data2.length;
                    for (let i0 = 0; i0 < len0; i0++) {
                      const _errs8 = errors;
                      if (
                        !validate55(data2[i0], {
                          instancePath: instancePath + "/skills/" + i0,
                          parentData: data2,
                          parentDataProperty: i0,
                          rootData,
                          dynamicAnchors,
                        })
                      ) {
                        vErrors =
                          vErrors === null
                            ? validate55.errors
                            : vErrors.concat(validate55.errors);
                        errors = vErrors.length;
                      }
                      var valid1 = _errs8 === errors;
                      if (!valid1) {
                        break;
                      }
                    }
                  } else {
                    validate58.errors = [
                      {
                        instancePath: instancePath + "/skills",
                        schemaPath: "#/properties/skills/type",
                        keyword: "type",
                        params: { type: "array" },
                        message: "must be array",
                      },
                    ];
                    return false;
                  }
                }
                var valid0 = _errs6 === errors;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.updatedAt !== undefined) {
                  let data4 = data.updatedAt;
                  const _errs9 = errors;
                  if (errors === _errs9) {
                    if (errors === _errs9) {
                      if (typeof data4 === "string") {
                        if (!formats6.validate(data4)) {
                          validate58.errors = [
                            {
                              instancePath: instancePath + "/updatedAt",
                              schemaPath: "#/properties/updatedAt/format",
                              keyword: "format",
                              params: { format: "date-time" },
                              message:
                                'must match format "' + "date-time" + '"',
                            },
                          ];
                          return false;
                        }
                      } else {
                        validate58.errors = [
                          {
                            instancePath: instancePath + "/updatedAt",
                            schemaPath: "#/properties/updatedAt/type",
                            keyword: "type",
                            params: { type: "string" },
                            message: "must be string",
                          },
                        ];
                        return false;
                      }
                    }
                  }
                  var valid0 = _errs9 === errors;
                } else {
                  var valid0 = true;
                }
                if (valid0) {
                  if (data.noteAr !== undefined) {
                    const _errs11 = errors;
                    if (typeof data.noteAr !== "string") {
                      validate58.errors = [
                        {
                          instancePath: instancePath + "/noteAr",
                          schemaPath: "#/properties/noteAr/type",
                          keyword: "type",
                          params: { type: "string" },
                          message: "must be string",
                        },
                      ];
                      return false;
                    }
                    var valid0 = _errs11 === errors;
                  } else {
                    var valid0 = true;
                  }
                }
              }
            }
          }
        }
      }
    } else {
      validate58.errors = [
        {
          instancePath,
          schemaPath: "#/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        },
      ];
      return false;
    }
  }
  validate58.errors = vErrors;
  return errors === 0;
}
validate58.evaluated = {
  props: true,
  dynamicProps: false,
  dynamicItems: false,
};
function validate57(
  data,
  {
    instancePath = "",
    parentData,
    parentDataProperty,
    rootData = data,
    dynamicAnchors = {},
  } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate57.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (errors === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (
        (data.data === undefined && (missing0 = "data")) ||
        (data.meta === undefined && (missing0 = "meta"))
      ) {
        validate57.errors = [
          {
            instancePath,
            schemaPath: "#/required",
            keyword: "required",
            params: { missingProperty: missing0 },
            message: "must have required property '" + missing0 + "'",
          },
        ];
        return false;
      } else {
        const _errs1 = errors;
        for (const key0 in data) {
          if (!(key0 === "data" || key0 === "meta")) {
            validate57.errors = [
              {
                instancePath,
                schemaPath: "#/additionalProperties",
                keyword: "additionalProperties",
                params: { additionalProperty: key0 },
                message: "must NOT have additional properties",
              },
            ];
            return false;
            break;
          }
        }
        if (_errs1 === errors) {
          if (data.data !== undefined) {
            const _errs2 = errors;
            if (
              !validate58(data.data, {
                instancePath: instancePath + "/data",
                parentData: data,
                parentDataProperty: "data",
                rootData,
                dynamicAnchors,
              })
            ) {
              vErrors =
                vErrors === null
                  ? validate58.errors
                  : vErrors.concat(validate58.errors);
              errors = vErrors.length;
            }
            var valid0 = _errs2 === errors;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.meta !== undefined) {
              let data1 = data.meta;
              const _errs3 = errors;
              const _errs4 = errors;
              if (errors === _errs4) {
                if (
                  data1 &&
                  typeof data1 == "object" &&
                  !Array.isArray(data1)
                ) {
                  let missing1;
                  if (
                    (data1.requestId === undefined &&
                      (missing1 = "requestId")) ||
                    (data1.serverTime === undefined &&
                      (missing1 = "serverTime")) ||
                    (data1.apiVersion === undefined &&
                      (missing1 = "apiVersion"))
                  ) {
                    validate57.errors = [
                      {
                        instancePath: instancePath + "/meta",
                        schemaPath: "#/components/schemas/Meta/required",
                        keyword: "required",
                        params: { missingProperty: missing1 },
                        message:
                          "must have required property '" + missing1 + "'",
                      },
                    ];
                    return false;
                  } else {
                    const _errs6 = errors;
                    for (const key1 in data1) {
                      if (
                        !(
                          key1 === "requestId" ||
                          key1 === "serverTime" ||
                          key1 === "apiVersion"
                        )
                      ) {
                        validate57.errors = [
                          {
                            instancePath: instancePath + "/meta",
                            schemaPath:
                              "#/components/schemas/Meta/additionalProperties",
                            keyword: "additionalProperties",
                            params: { additionalProperty: key1 },
                            message: "must NOT have additional properties",
                          },
                        ];
                        return false;
                        break;
                      }
                    }
                    if (_errs6 === errors) {
                      if (data1.requestId !== undefined) {
                        let data2 = data1.requestId;
                        const _errs7 = errors;
                        if (errors === _errs7) {
                          if (errors === _errs7) {
                            if (typeof data2 === "string") {
                              if (!formats4.test(data2)) {
                                validate57.errors = [
                                  {
                                    instancePath:
                                      instancePath + "/meta/requestId",
                                    schemaPath:
                                      "#/components/schemas/Meta/properties/requestId/format",
                                    keyword: "format",
                                    params: { format: "uuid" },
                                    message:
                                      'must match format "' + "uuid" + '"',
                                  },
                                ];
                                return false;
                              }
                            } else {
                              validate57.errors = [
                                {
                                  instancePath:
                                    instancePath + "/meta/requestId",
                                  schemaPath:
                                    "#/components/schemas/Meta/properties/requestId/type",
                                  keyword: "type",
                                  params: { type: "string" },
                                  message: "must be string",
                                },
                              ];
                              return false;
                            }
                          }
                        }
                        var valid2 = _errs7 === errors;
                      } else {
                        var valid2 = true;
                      }
                      if (valid2) {
                        if (data1.serverTime !== undefined) {
                          let data3 = data1.serverTime;
                          const _errs9 = errors;
                          if (errors === _errs9) {
                            if (errors === _errs9) {
                              if (typeof data3 === "string") {
                                if (!formats6.validate(data3)) {
                                  validate57.errors = [
                                    {
                                      instancePath:
                                        instancePath + "/meta/serverTime",
                                      schemaPath:
                                        "#/components/schemas/Meta/properties/serverTime/format",
                                      keyword: "format",
                                      params: { format: "date-time" },
                                      message:
                                        'must match format "' +
                                        "date-time" +
                                        '"',
                                    },
                                  ];
                                  return false;
                                }
                              } else {
                                validate57.errors = [
                                  {
                                    instancePath:
                                      instancePath + "/meta/serverTime",
                                    schemaPath:
                                      "#/components/schemas/Meta/properties/serverTime/type",
                                    keyword: "type",
                                    params: { type: "string" },
                                    message: "must be string",
                                  },
                                ];
                                return false;
                              }
                            }
                          }
                          var valid2 = _errs9 === errors;
                        } else {
                          var valid2 = true;
                        }
                        if (valid2) {
                          if (data1.apiVersion !== undefined) {
                            const _errs11 = errors;
                            if (typeof data1.apiVersion !== "string") {
                              validate57.errors = [
                                {
                                  instancePath:
                                    instancePath + "/meta/apiVersion",
                                  schemaPath:
                                    "#/components/schemas/Meta/properties/apiVersion/type",
                                  keyword: "type",
                                  params: { type: "string" },
                                  message: "must be string",
                                },
                              ];
                              return false;
                            }
                            var valid2 = _errs11 === errors;
                          } else {
                            var valid2 = true;
                          }
                        }
                      }
                    }
                  }
                } else {
                  validate57.errors = [
                    {
                      instancePath: instancePath + "/meta",
                      schemaPath: "#/components/schemas/Meta/type",
                      keyword: "type",
                      params: { type: "object" },
                      message: "must be object",
                    },
                  ];
                  return false;
                }
              }
              var valid0 = _errs3 === errors;
            } else {
              var valid0 = true;
            }
          }
        }
      }
    } else {
      validate57.errors = [
        {
          instancePath,
          schemaPath: "#/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        },
      ];
      return false;
    }
  }
  validate57.errors = vErrors;
  return errors === 0;
}
validate57.evaluated = {
  props: true,
  dynamicProps: false,
  dynamicItems: false,
};
exports.EpisodeEnvelope = validate61;
const schema74 = {
  type: "object",
  additionalProperties: false,
  properties: {
    data: { $ref: "#/components/schemas/LearningEpisode" },
    meta: { $ref: "#/components/schemas/Meta" },
  },
  required: ["data", "meta"],
};
const schema75 = {
  type: "object",
  additionalProperties: false,
  properties: {
    id: { type: "string", format: "uuid" },
    rootAttemptId: { type: "string", format: "uuid" },
    skillId: { type: "string", format: "uuid" },
    state: { $ref: "#/components/schemas/LearningEpisodeState" },
    assignments: {
      type: "array",
      items: { $ref: "#/components/schemas/Assignment" },
    },
    createdAt: { type: "string", format: "date-time" },
    endedAt: {
      anyOf: [{ type: "string", format: "date-time" }, { type: "null" }],
    },
    nextAction: {
      type: "string",
      enum: [
        "answer_probe",
        "start_remediation",
        "complete_remediation",
        "start_transfer",
        "review_progress",
        "none",
      ],
    },
  },
  required: [
    "id",
    "rootAttemptId",
    "skillId",
    "state",
    "assignments",
    "createdAt",
    "endedAt",
    "nextAction",
  ],
};
const schema76 = {
  type: "string",
  enum: [
    "proposed",
    "probing",
    "remediating",
    "awaiting_transfer",
    "finished",
    "cancelled",
  ],
};
const schema77 = {
  type: "object",
  additionalProperties: false,
  properties: {
    id: { type: "string", format: "uuid" },
    episodeId: { type: "string", format: "uuid" },
    phase: { type: "string", enum: ["probe", "remediation", "transfer"] },
    problemRevisionId: { type: "string", format: "uuid" },
    problem: { $ref: "#/components/schemas/ProblemDetail" },
    assistancePolicy: {
      type: "string",
      enum: ["guided", "limited", "independent"],
    },
    attemptId: {
      anyOf: [{ type: "string", format: "uuid" }, { type: "null" }],
    },
    assignedAt: { type: "string", format: "date-time" },
  },
  required: [
    "id",
    "episodeId",
    "phase",
    "problemRevisionId",
    "problem",
    "assistancePolicy",
    "attemptId",
    "assignedAt",
  ],
};
function validate63(
  data,
  {
    instancePath = "",
    parentData,
    parentDataProperty,
    rootData = data,
    dynamicAnchors = {},
  } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate63.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (errors === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (
        (data.id === undefined && (missing0 = "id")) ||
        (data.episodeId === undefined && (missing0 = "episodeId")) ||
        (data.phase === undefined && (missing0 = "phase")) ||
        (data.problemRevisionId === undefined &&
          (missing0 = "problemRevisionId")) ||
        (data.problem === undefined && (missing0 = "problem")) ||
        (data.assistancePolicy === undefined &&
          (missing0 = "assistancePolicy")) ||
        (data.attemptId === undefined && (missing0 = "attemptId")) ||
        (data.assignedAt === undefined && (missing0 = "assignedAt"))
      ) {
        validate63.errors = [
          {
            instancePath,
            schemaPath: "#/required",
            keyword: "required",
            params: { missingProperty: missing0 },
            message: "must have required property '" + missing0 + "'",
          },
        ];
        return false;
      } else {
        const _errs1 = errors;
        for (const key0 in data) {
          if (
            !(
              key0 === "id" ||
              key0 === "episodeId" ||
              key0 === "phase" ||
              key0 === "problemRevisionId" ||
              key0 === "problem" ||
              key0 === "assistancePolicy" ||
              key0 === "attemptId" ||
              key0 === "assignedAt"
            )
          ) {
            validate63.errors = [
              {
                instancePath,
                schemaPath: "#/additionalProperties",
                keyword: "additionalProperties",
                params: { additionalProperty: key0 },
                message: "must NOT have additional properties",
              },
            ];
            return false;
            break;
          }
        }
        if (_errs1 === errors) {
          if (data.id !== undefined) {
            let data0 = data.id;
            const _errs2 = errors;
            if (errors === _errs2) {
              if (errors === _errs2) {
                if (typeof data0 === "string") {
                  if (!formats4.test(data0)) {
                    validate63.errors = [
                      {
                        instancePath: instancePath + "/id",
                        schemaPath: "#/properties/id/format",
                        keyword: "format",
                        params: { format: "uuid" },
                        message: 'must match format "' + "uuid" + '"',
                      },
                    ];
                    return false;
                  }
                } else {
                  validate63.errors = [
                    {
                      instancePath: instancePath + "/id",
                      schemaPath: "#/properties/id/type",
                      keyword: "type",
                      params: { type: "string" },
                      message: "must be string",
                    },
                  ];
                  return false;
                }
              }
            }
            var valid0 = _errs2 === errors;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.episodeId !== undefined) {
              let data1 = data.episodeId;
              const _errs4 = errors;
              if (errors === _errs4) {
                if (errors === _errs4) {
                  if (typeof data1 === "string") {
                    if (!formats4.test(data1)) {
                      validate63.errors = [
                        {
                          instancePath: instancePath + "/episodeId",
                          schemaPath: "#/properties/episodeId/format",
                          keyword: "format",
                          params: { format: "uuid" },
                          message: 'must match format "' + "uuid" + '"',
                        },
                      ];
                      return false;
                    }
                  } else {
                    validate63.errors = [
                      {
                        instancePath: instancePath + "/episodeId",
                        schemaPath: "#/properties/episodeId/type",
                        keyword: "type",
                        params: { type: "string" },
                        message: "must be string",
                      },
                    ];
                    return false;
                  }
                }
              }
              var valid0 = _errs4 === errors;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.phase !== undefined) {
                let data2 = data.phase;
                const _errs6 = errors;
                if (typeof data2 !== "string") {
                  validate63.errors = [
                    {
                      instancePath: instancePath + "/phase",
                      schemaPath: "#/properties/phase/type",
                      keyword: "type",
                      params: { type: "string" },
                      message: "must be string",
                    },
                  ];
                  return false;
                }
                if (
                  !(
                    data2 === "probe" ||
                    data2 === "remediation" ||
                    data2 === "transfer"
                  )
                ) {
                  validate63.errors = [
                    {
                      instancePath: instancePath + "/phase",
                      schemaPath: "#/properties/phase/enum",
                      keyword: "enum",
                      params: { allowedValues: schema77.properties.phase.enum },
                      message: "must be equal to one of the allowed values",
                    },
                  ];
                  return false;
                }
                var valid0 = _errs6 === errors;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.problemRevisionId !== undefined) {
                  let data3 = data.problemRevisionId;
                  const _errs8 = errors;
                  if (errors === _errs8) {
                    if (errors === _errs8) {
                      if (typeof data3 === "string") {
                        if (!formats4.test(data3)) {
                          validate63.errors = [
                            {
                              instancePath: instancePath + "/problemRevisionId",
                              schemaPath:
                                "#/properties/problemRevisionId/format",
                              keyword: "format",
                              params: { format: "uuid" },
                              message: 'must match format "' + "uuid" + '"',
                            },
                          ];
                          return false;
                        }
                      } else {
                        validate63.errors = [
                          {
                            instancePath: instancePath + "/problemRevisionId",
                            schemaPath: "#/properties/problemRevisionId/type",
                            keyword: "type",
                            params: { type: "string" },
                            message: "must be string",
                          },
                        ];
                        return false;
                      }
                    }
                  }
                  var valid0 = _errs8 === errors;
                } else {
                  var valid0 = true;
                }
                if (valid0) {
                  if (data.problem !== undefined) {
                    const _errs10 = errors;
                    if (
                      !validate46(data.problem, {
                        instancePath: instancePath + "/problem",
                        parentData: data,
                        parentDataProperty: "problem",
                        rootData,
                        dynamicAnchors,
                      })
                    ) {
                      vErrors =
                        vErrors === null
                          ? validate46.errors
                          : vErrors.concat(validate46.errors);
                      errors = vErrors.length;
                    }
                    var valid0 = _errs10 === errors;
                  } else {
                    var valid0 = true;
                  }
                  if (valid0) {
                    if (data.assistancePolicy !== undefined) {
                      let data5 = data.assistancePolicy;
                      const _errs11 = errors;
                      if (typeof data5 !== "string") {
                        validate63.errors = [
                          {
                            instancePath: instancePath + "/assistancePolicy",
                            schemaPath: "#/properties/assistancePolicy/type",
                            keyword: "type",
                            params: { type: "string" },
                            message: "must be string",
                          },
                        ];
                        return false;
                      }
                      if (
                        !(
                          data5 === "guided" ||
                          data5 === "limited" ||
                          data5 === "independent"
                        )
                      ) {
                        validate63.errors = [
                          {
                            instancePath: instancePath + "/assistancePolicy",
                            schemaPath: "#/properties/assistancePolicy/enum",
                            keyword: "enum",
                            params: {
                              allowedValues:
                                schema77.properties.assistancePolicy.enum,
                            },
                            message:
                              "must be equal to one of the allowed values",
                          },
                        ];
                        return false;
                      }
                      var valid0 = _errs11 === errors;
                    } else {
                      var valid0 = true;
                    }
                    if (valid0) {
                      if (data.attemptId !== undefined) {
                        let data6 = data.attemptId;
                        const _errs13 = errors;
                        const _errs14 = errors;
                        let valid1 = false;
                        const _errs15 = errors;
                        if (errors === _errs15) {
                          if (errors === _errs15) {
                            if (typeof data6 === "string") {
                              if (!formats4.test(data6)) {
                                const err0 = {
                                  instancePath: instancePath + "/attemptId",
                                  schemaPath:
                                    "#/properties/attemptId/anyOf/0/format",
                                  keyword: "format",
                                  params: { format: "uuid" },
                                  message: 'must match format "' + "uuid" + '"',
                                };
                                if (vErrors === null) {
                                  vErrors = [err0];
                                } else {
                                  vErrors.push(err0);
                                }
                                errors++;
                              }
                            } else {
                              const err1 = {
                                instancePath: instancePath + "/attemptId",
                                schemaPath:
                                  "#/properties/attemptId/anyOf/0/type",
                                keyword: "type",
                                params: { type: "string" },
                                message: "must be string",
                              };
                              if (vErrors === null) {
                                vErrors = [err1];
                              } else {
                                vErrors.push(err1);
                              }
                              errors++;
                            }
                          }
                        }
                        var _valid0 = _errs15 === errors;
                        valid1 = valid1 || _valid0;
                        const _errs17 = errors;
                        if (data6 !== null) {
                          const err2 = {
                            instancePath: instancePath + "/attemptId",
                            schemaPath: "#/properties/attemptId/anyOf/1/type",
                            keyword: "type",
                            params: { type: "null" },
                            message: "must be null",
                          };
                          if (vErrors === null) {
                            vErrors = [err2];
                          } else {
                            vErrors.push(err2);
                          }
                          errors++;
                        }
                        var _valid0 = _errs17 === errors;
                        valid1 = valid1 || _valid0;
                        if (!valid1) {
                          const err3 = {
                            instancePath: instancePath + "/attemptId",
                            schemaPath: "#/properties/attemptId/anyOf",
                            keyword: "anyOf",
                            params: {},
                            message: "must match a schema in anyOf",
                          };
                          if (vErrors === null) {
                            vErrors = [err3];
                          } else {
                            vErrors.push(err3);
                          }
                          errors++;
                          validate63.errors = vErrors;
                          return false;
                        } else {
                          errors = _errs14;
                          if (vErrors !== null) {
                            if (_errs14) {
                              vErrors.length = _errs14;
                            } else {
                              vErrors = null;
                            }
                          }
                        }
                        var valid0 = _errs13 === errors;
                      } else {
                        var valid0 = true;
                      }
                      if (valid0) {
                        if (data.assignedAt !== undefined) {
                          let data7 = data.assignedAt;
                          const _errs19 = errors;
                          if (errors === _errs19) {
                            if (errors === _errs19) {
                              if (typeof data7 === "string") {
                                if (!formats6.validate(data7)) {
                                  validate63.errors = [
                                    {
                                      instancePath:
                                        instancePath + "/assignedAt",
                                      schemaPath:
                                        "#/properties/assignedAt/format",
                                      keyword: "format",
                                      params: { format: "date-time" },
                                      message:
                                        'must match format "' +
                                        "date-time" +
                                        '"',
                                    },
                                  ];
                                  return false;
                                }
                              } else {
                                validate63.errors = [
                                  {
                                    instancePath: instancePath + "/assignedAt",
                                    schemaPath: "#/properties/assignedAt/type",
                                    keyword: "type",
                                    params: { type: "string" },
                                    message: "must be string",
                                  },
                                ];
                                return false;
                              }
                            }
                          }
                          var valid0 = _errs19 === errors;
                        } else {
                          var valid0 = true;
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    } else {
      validate63.errors = [
        {
          instancePath,
          schemaPath: "#/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        },
      ];
      return false;
    }
  }
  validate63.errors = vErrors;
  return errors === 0;
}
validate63.evaluated = {
  props: true,
  dynamicProps: false,
  dynamicItems: false,
};
function validate62(
  data,
  {
    instancePath = "",
    parentData,
    parentDataProperty,
    rootData = data,
    dynamicAnchors = {},
  } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate62.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (errors === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (
        (data.id === undefined && (missing0 = "id")) ||
        (data.rootAttemptId === undefined && (missing0 = "rootAttemptId")) ||
        (data.skillId === undefined && (missing0 = "skillId")) ||
        (data.state === undefined && (missing0 = "state")) ||
        (data.assignments === undefined && (missing0 = "assignments")) ||
        (data.createdAt === undefined && (missing0 = "createdAt")) ||
        (data.endedAt === undefined && (missing0 = "endedAt")) ||
        (data.nextAction === undefined && (missing0 = "nextAction"))
      ) {
        validate62.errors = [
          {
            instancePath,
            schemaPath: "#/required",
            keyword: "required",
            params: { missingProperty: missing0 },
            message: "must have required property '" + missing0 + "'",
          },
        ];
        return false;
      } else {
        const _errs1 = errors;
        for (const key0 in data) {
          if (
            !(
              key0 === "id" ||
              key0 === "rootAttemptId" ||
              key0 === "skillId" ||
              key0 === "state" ||
              key0 === "assignments" ||
              key0 === "createdAt" ||
              key0 === "endedAt" ||
              key0 === "nextAction"
            )
          ) {
            validate62.errors = [
              {
                instancePath,
                schemaPath: "#/additionalProperties",
                keyword: "additionalProperties",
                params: { additionalProperty: key0 },
                message: "must NOT have additional properties",
              },
            ];
            return false;
            break;
          }
        }
        if (_errs1 === errors) {
          if (data.id !== undefined) {
            let data0 = data.id;
            const _errs2 = errors;
            if (errors === _errs2) {
              if (errors === _errs2) {
                if (typeof data0 === "string") {
                  if (!formats4.test(data0)) {
                    validate62.errors = [
                      {
                        instancePath: instancePath + "/id",
                        schemaPath: "#/properties/id/format",
                        keyword: "format",
                        params: { format: "uuid" },
                        message: 'must match format "' + "uuid" + '"',
                      },
                    ];
                    return false;
                  }
                } else {
                  validate62.errors = [
                    {
                      instancePath: instancePath + "/id",
                      schemaPath: "#/properties/id/type",
                      keyword: "type",
                      params: { type: "string" },
                      message: "must be string",
                    },
                  ];
                  return false;
                }
              }
            }
            var valid0 = _errs2 === errors;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.rootAttemptId !== undefined) {
              let data1 = data.rootAttemptId;
              const _errs4 = errors;
              if (errors === _errs4) {
                if (errors === _errs4) {
                  if (typeof data1 === "string") {
                    if (!formats4.test(data1)) {
                      validate62.errors = [
                        {
                          instancePath: instancePath + "/rootAttemptId",
                          schemaPath: "#/properties/rootAttemptId/format",
                          keyword: "format",
                          params: { format: "uuid" },
                          message: 'must match format "' + "uuid" + '"',
                        },
                      ];
                      return false;
                    }
                  } else {
                    validate62.errors = [
                      {
                        instancePath: instancePath + "/rootAttemptId",
                        schemaPath: "#/properties/rootAttemptId/type",
                        keyword: "type",
                        params: { type: "string" },
                        message: "must be string",
                      },
                    ];
                    return false;
                  }
                }
              }
              var valid0 = _errs4 === errors;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.skillId !== undefined) {
                let data2 = data.skillId;
                const _errs6 = errors;
                if (errors === _errs6) {
                  if (errors === _errs6) {
                    if (typeof data2 === "string") {
                      if (!formats4.test(data2)) {
                        validate62.errors = [
                          {
                            instancePath: instancePath + "/skillId",
                            schemaPath: "#/properties/skillId/format",
                            keyword: "format",
                            params: { format: "uuid" },
                            message: 'must match format "' + "uuid" + '"',
                          },
                        ];
                        return false;
                      }
                    } else {
                      validate62.errors = [
                        {
                          instancePath: instancePath + "/skillId",
                          schemaPath: "#/properties/skillId/type",
                          keyword: "type",
                          params: { type: "string" },
                          message: "must be string",
                        },
                      ];
                      return false;
                    }
                  }
                }
                var valid0 = _errs6 === errors;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.state !== undefined) {
                  let data3 = data.state;
                  const _errs8 = errors;
                  if (typeof data3 !== "string") {
                    validate62.errors = [
                      {
                        instancePath: instancePath + "/state",
                        schemaPath:
                          "#/components/schemas/LearningEpisodeState/type",
                        keyword: "type",
                        params: { type: "string" },
                        message: "must be string",
                      },
                    ];
                    return false;
                  }
                  if (
                    !(
                      data3 === "proposed" ||
                      data3 === "probing" ||
                      data3 === "remediating" ||
                      data3 === "awaiting_transfer" ||
                      data3 === "finished" ||
                      data3 === "cancelled"
                    )
                  ) {
                    validate62.errors = [
                      {
                        instancePath: instancePath + "/state",
                        schemaPath:
                          "#/components/schemas/LearningEpisodeState/enum",
                        keyword: "enum",
                        params: { allowedValues: schema76.enum },
                        message: "must be equal to one of the allowed values",
                      },
                    ];
                    return false;
                  }
                  var valid0 = _errs8 === errors;
                } else {
                  var valid0 = true;
                }
                if (valid0) {
                  if (data.assignments !== undefined) {
                    let data4 = data.assignments;
                    const _errs11 = errors;
                    if (errors === _errs11) {
                      if (Array.isArray(data4)) {
                        var valid2 = true;
                        const len0 = data4.length;
                        for (let i0 = 0; i0 < len0; i0++) {
                          const _errs13 = errors;
                          if (
                            !validate63(data4[i0], {
                              instancePath: instancePath + "/assignments/" + i0,
                              parentData: data4,
                              parentDataProperty: i0,
                              rootData,
                              dynamicAnchors,
                            })
                          ) {
                            vErrors =
                              vErrors === null
                                ? validate63.errors
                                : vErrors.concat(validate63.errors);
                            errors = vErrors.length;
                          }
                          var valid2 = _errs13 === errors;
                          if (!valid2) {
                            break;
                          }
                        }
                      } else {
                        validate62.errors = [
                          {
                            instancePath: instancePath + "/assignments",
                            schemaPath: "#/properties/assignments/type",
                            keyword: "type",
                            params: { type: "array" },
                            message: "must be array",
                          },
                        ];
                        return false;
                      }
                    }
                    var valid0 = _errs11 === errors;
                  } else {
                    var valid0 = true;
                  }
                  if (valid0) {
                    if (data.createdAt !== undefined) {
                      let data6 = data.createdAt;
                      const _errs14 = errors;
                      if (errors === _errs14) {
                        if (errors === _errs14) {
                          if (typeof data6 === "string") {
                            if (!formats6.validate(data6)) {
                              validate62.errors = [
                                {
                                  instancePath: instancePath + "/createdAt",
                                  schemaPath: "#/properties/createdAt/format",
                                  keyword: "format",
                                  params: { format: "date-time" },
                                  message:
                                    'must match format "' + "date-time" + '"',
                                },
                              ];
                              return false;
                            }
                          } else {
                            validate62.errors = [
                              {
                                instancePath: instancePath + "/createdAt",
                                schemaPath: "#/properties/createdAt/type",
                                keyword: "type",
                                params: { type: "string" },
                                message: "must be string",
                              },
                            ];
                            return false;
                          }
                        }
                      }
                      var valid0 = _errs14 === errors;
                    } else {
                      var valid0 = true;
                    }
                    if (valid0) {
                      if (data.endedAt !== undefined) {
                        let data7 = data.endedAt;
                        const _errs16 = errors;
                        const _errs17 = errors;
                        let valid3 = false;
                        const _errs18 = errors;
                        if (errors === _errs18) {
                          if (errors === _errs18) {
                            if (typeof data7 === "string") {
                              if (!formats6.validate(data7)) {
                                const err0 = {
                                  instancePath: instancePath + "/endedAt",
                                  schemaPath:
                                    "#/properties/endedAt/anyOf/0/format",
                                  keyword: "format",
                                  params: { format: "date-time" },
                                  message:
                                    'must match format "' + "date-time" + '"',
                                };
                                if (vErrors === null) {
                                  vErrors = [err0];
                                } else {
                                  vErrors.push(err0);
                                }
                                errors++;
                              }
                            } else {
                              const err1 = {
                                instancePath: instancePath + "/endedAt",
                                schemaPath: "#/properties/endedAt/anyOf/0/type",
                                keyword: "type",
                                params: { type: "string" },
                                message: "must be string",
                              };
                              if (vErrors === null) {
                                vErrors = [err1];
                              } else {
                                vErrors.push(err1);
                              }
                              errors++;
                            }
                          }
                        }
                        var _valid0 = _errs18 === errors;
                        valid3 = valid3 || _valid0;
                        const _errs20 = errors;
                        if (data7 !== null) {
                          const err2 = {
                            instancePath: instancePath + "/endedAt",
                            schemaPath: "#/properties/endedAt/anyOf/1/type",
                            keyword: "type",
                            params: { type: "null" },
                            message: "must be null",
                          };
                          if (vErrors === null) {
                            vErrors = [err2];
                          } else {
                            vErrors.push(err2);
                          }
                          errors++;
                        }
                        var _valid0 = _errs20 === errors;
                        valid3 = valid3 || _valid0;
                        if (!valid3) {
                          const err3 = {
                            instancePath: instancePath + "/endedAt",
                            schemaPath: "#/properties/endedAt/anyOf",
                            keyword: "anyOf",
                            params: {},
                            message: "must match a schema in anyOf",
                          };
                          if (vErrors === null) {
                            vErrors = [err3];
                          } else {
                            vErrors.push(err3);
                          }
                          errors++;
                          validate62.errors = vErrors;
                          return false;
                        } else {
                          errors = _errs17;
                          if (vErrors !== null) {
                            if (_errs17) {
                              vErrors.length = _errs17;
                            } else {
                              vErrors = null;
                            }
                          }
                        }
                        var valid0 = _errs16 === errors;
                      } else {
                        var valid0 = true;
                      }
                      if (valid0) {
                        if (data.nextAction !== undefined) {
                          let data8 = data.nextAction;
                          const _errs22 = errors;
                          if (typeof data8 !== "string") {
                            validate62.errors = [
                              {
                                instancePath: instancePath + "/nextAction",
                                schemaPath: "#/properties/nextAction/type",
                                keyword: "type",
                                params: { type: "string" },
                                message: "must be string",
                              },
                            ];
                            return false;
                          }
                          if (
                            !(
                              data8 === "answer_probe" ||
                              data8 === "start_remediation" ||
                              data8 === "complete_remediation" ||
                              data8 === "start_transfer" ||
                              data8 === "review_progress" ||
                              data8 === "none"
                            )
                          ) {
                            validate62.errors = [
                              {
                                instancePath: instancePath + "/nextAction",
                                schemaPath: "#/properties/nextAction/enum",
                                keyword: "enum",
                                params: {
                                  allowedValues:
                                    schema75.properties.nextAction.enum,
                                },
                                message:
                                  "must be equal to one of the allowed values",
                              },
                            ];
                            return false;
                          }
                          var valid0 = _errs22 === errors;
                        } else {
                          var valid0 = true;
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    } else {
      validate62.errors = [
        {
          instancePath,
          schemaPath: "#/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        },
      ];
      return false;
    }
  }
  validate62.errors = vErrors;
  return errors === 0;
}
validate62.evaluated = {
  props: true,
  dynamicProps: false,
  dynamicItems: false,
};
function validate61(
  data,
  {
    instancePath = "",
    parentData,
    parentDataProperty,
    rootData = data,
    dynamicAnchors = {},
  } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate61.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (errors === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (
        (data.data === undefined && (missing0 = "data")) ||
        (data.meta === undefined && (missing0 = "meta"))
      ) {
        validate61.errors = [
          {
            instancePath,
            schemaPath: "#/required",
            keyword: "required",
            params: { missingProperty: missing0 },
            message: "must have required property '" + missing0 + "'",
          },
        ];
        return false;
      } else {
        const _errs1 = errors;
        for (const key0 in data) {
          if (!(key0 === "data" || key0 === "meta")) {
            validate61.errors = [
              {
                instancePath,
                schemaPath: "#/additionalProperties",
                keyword: "additionalProperties",
                params: { additionalProperty: key0 },
                message: "must NOT have additional properties",
              },
            ];
            return false;
            break;
          }
        }
        if (_errs1 === errors) {
          if (data.data !== undefined) {
            const _errs2 = errors;
            if (
              !validate62(data.data, {
                instancePath: instancePath + "/data",
                parentData: data,
                parentDataProperty: "data",
                rootData,
                dynamicAnchors,
              })
            ) {
              vErrors =
                vErrors === null
                  ? validate62.errors
                  : vErrors.concat(validate62.errors);
              errors = vErrors.length;
            }
            var valid0 = _errs2 === errors;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.meta !== undefined) {
              let data1 = data.meta;
              const _errs3 = errors;
              const _errs4 = errors;
              if (errors === _errs4) {
                if (
                  data1 &&
                  typeof data1 == "object" &&
                  !Array.isArray(data1)
                ) {
                  let missing1;
                  if (
                    (data1.requestId === undefined &&
                      (missing1 = "requestId")) ||
                    (data1.serverTime === undefined &&
                      (missing1 = "serverTime")) ||
                    (data1.apiVersion === undefined &&
                      (missing1 = "apiVersion"))
                  ) {
                    validate61.errors = [
                      {
                        instancePath: instancePath + "/meta",
                        schemaPath: "#/components/schemas/Meta/required",
                        keyword: "required",
                        params: { missingProperty: missing1 },
                        message:
                          "must have required property '" + missing1 + "'",
                      },
                    ];
                    return false;
                  } else {
                    const _errs6 = errors;
                    for (const key1 in data1) {
                      if (
                        !(
                          key1 === "requestId" ||
                          key1 === "serverTime" ||
                          key1 === "apiVersion"
                        )
                      ) {
                        validate61.errors = [
                          {
                            instancePath: instancePath + "/meta",
                            schemaPath:
                              "#/components/schemas/Meta/additionalProperties",
                            keyword: "additionalProperties",
                            params: { additionalProperty: key1 },
                            message: "must NOT have additional properties",
                          },
                        ];
                        return false;
                        break;
                      }
                    }
                    if (_errs6 === errors) {
                      if (data1.requestId !== undefined) {
                        let data2 = data1.requestId;
                        const _errs7 = errors;
                        if (errors === _errs7) {
                          if (errors === _errs7) {
                            if (typeof data2 === "string") {
                              if (!formats4.test(data2)) {
                                validate61.errors = [
                                  {
                                    instancePath:
                                      instancePath + "/meta/requestId",
                                    schemaPath:
                                      "#/components/schemas/Meta/properties/requestId/format",
                                    keyword: "format",
                                    params: { format: "uuid" },
                                    message:
                                      'must match format "' + "uuid" + '"',
                                  },
                                ];
                                return false;
                              }
                            } else {
                              validate61.errors = [
                                {
                                  instancePath:
                                    instancePath + "/meta/requestId",
                                  schemaPath:
                                    "#/components/schemas/Meta/properties/requestId/type",
                                  keyword: "type",
                                  params: { type: "string" },
                                  message: "must be string",
                                },
                              ];
                              return false;
                            }
                          }
                        }
                        var valid2 = _errs7 === errors;
                      } else {
                        var valid2 = true;
                      }
                      if (valid2) {
                        if (data1.serverTime !== undefined) {
                          let data3 = data1.serverTime;
                          const _errs9 = errors;
                          if (errors === _errs9) {
                            if (errors === _errs9) {
                              if (typeof data3 === "string") {
                                if (!formats6.validate(data3)) {
                                  validate61.errors = [
                                    {
                                      instancePath:
                                        instancePath + "/meta/serverTime",
                                      schemaPath:
                                        "#/components/schemas/Meta/properties/serverTime/format",
                                      keyword: "format",
                                      params: { format: "date-time" },
                                      message:
                                        'must match format "' +
                                        "date-time" +
                                        '"',
                                    },
                                  ];
                                  return false;
                                }
                              } else {
                                validate61.errors = [
                                  {
                                    instancePath:
                                      instancePath + "/meta/serverTime",
                                    schemaPath:
                                      "#/components/schemas/Meta/properties/serverTime/type",
                                    keyword: "type",
                                    params: { type: "string" },
                                    message: "must be string",
                                  },
                                ];
                                return false;
                              }
                            }
                          }
                          var valid2 = _errs9 === errors;
                        } else {
                          var valid2 = true;
                        }
                        if (valid2) {
                          if (data1.apiVersion !== undefined) {
                            const _errs11 = errors;
                            if (typeof data1.apiVersion !== "string") {
                              validate61.errors = [
                                {
                                  instancePath:
                                    instancePath + "/meta/apiVersion",
                                  schemaPath:
                                    "#/components/schemas/Meta/properties/apiVersion/type",
                                  keyword: "type",
                                  params: { type: "string" },
                                  message: "must be string",
                                },
                              ];
                              return false;
                            }
                            var valid2 = _errs11 === errors;
                          } else {
                            var valid2 = true;
                          }
                        }
                      }
                    }
                  }
                } else {
                  validate61.errors = [
                    {
                      instancePath: instancePath + "/meta",
                      schemaPath: "#/components/schemas/Meta/type",
                      keyword: "type",
                      params: { type: "object" },
                      message: "must be object",
                    },
                  ];
                  return false;
                }
              }
              var valid0 = _errs3 === errors;
            } else {
              var valid0 = true;
            }
          }
        }
      }
    } else {
      validate61.errors = [
        {
          instancePath,
          schemaPath: "#/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        },
      ];
      return false;
    }
  }
  validate61.errors = vErrors;
  return errors === 0;
}
validate61.evaluated = {
  props: true,
  dynamicProps: false,
  dynamicItems: false,
};
exports.HintEnvelope = validate67;
const schema79 = {
  type: "object",
  additionalProperties: false,
  properties: {
    data: { $ref: "#/components/schemas/TutoringEvent" },
    meta: { $ref: "#/components/schemas/Meta" },
  },
  required: ["data", "meta"],
};
const schema80 = {
  type: "object",
  additionalProperties: false,
  properties: {
    id: { type: "string", format: "uuid" },
    attemptId: { type: "string", format: "uuid" },
    attemptRevision: {
      type: "integer",
      format: "int32",
      description:
        "إصدار محاولة، يعادل bigint في PostgreSQL لكنه مقيد هنا إلى Int32 آمن لواجهات JavaScript.",
      minimum: 0,
      maximum: 2147483647,
      example: 4,
    },
    eventType: {
      type: "string",
      enum: ["hint", "full_solution", "fallback", "pause"],
    },
    hintLevel: { $ref: "#/components/schemas/HintLevel" },
    textAr: {
      type: "string",
      description: "رسالة عربية مراجعة أو مولدة خاضعة للتصفية والتحقق.",
    },
    solutionStepsAr: {
      type: "array",
      items: {
        type: "string",
        description: "خطوة معتمدة رياضيًا، لا ينتجها LLM بلا تحقق.",
      },
    },
    generationSource: {
      type: "string",
      enum: ["reviewed_template", "llm_validated", "manual"],
    },
    independentEvidenceEligible: {
      type: "boolean",
      description: "false عند عرض H4 أو الحل الكامل.",
    },
    createdAt: { type: "string", format: "date-time" },
  },
  required: [
    "id",
    "attemptId",
    "attemptRevision",
    "eventType",
    "hintLevel",
    "textAr",
    "solutionStepsAr",
    "generationSource",
    "independentEvidenceEligible",
    "createdAt",
  ],
};
const schema81 = {
  type: "string",
  description: "المساعدة من دون تلميح إلى الحل الكامل.",
  enum: ["H0", "H1", "H2", "H3", "H4"],
};
function validate68(
  data,
  {
    instancePath = "",
    parentData,
    parentDataProperty,
    rootData = data,
    dynamicAnchors = {},
  } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate68.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (errors === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (
        (data.id === undefined && (missing0 = "id")) ||
        (data.attemptId === undefined && (missing0 = "attemptId")) ||
        (data.attemptRevision === undefined &&
          (missing0 = "attemptRevision")) ||
        (data.eventType === undefined && (missing0 = "eventType")) ||
        (data.hintLevel === undefined && (missing0 = "hintLevel")) ||
        (data.textAr === undefined && (missing0 = "textAr")) ||
        (data.solutionStepsAr === undefined &&
          (missing0 = "solutionStepsAr")) ||
        (data.generationSource === undefined &&
          (missing0 = "generationSource")) ||
        (data.independentEvidenceEligible === undefined &&
          (missing0 = "independentEvidenceEligible")) ||
        (data.createdAt === undefined && (missing0 = "createdAt"))
      ) {
        validate68.errors = [
          {
            instancePath,
            schemaPath: "#/required",
            keyword: "required",
            params: { missingProperty: missing0 },
            message: "must have required property '" + missing0 + "'",
          },
        ];
        return false;
      } else {
        const _errs1 = errors;
        for (const key0 in data) {
          if (!func1.call(schema80.properties, key0)) {
            validate68.errors = [
              {
                instancePath,
                schemaPath: "#/additionalProperties",
                keyword: "additionalProperties",
                params: { additionalProperty: key0 },
                message: "must NOT have additional properties",
              },
            ];
            return false;
            break;
          }
        }
        if (_errs1 === errors) {
          if (data.id !== undefined) {
            let data0 = data.id;
            const _errs2 = errors;
            if (errors === _errs2) {
              if (errors === _errs2) {
                if (typeof data0 === "string") {
                  if (!formats4.test(data0)) {
                    validate68.errors = [
                      {
                        instancePath: instancePath + "/id",
                        schemaPath: "#/properties/id/format",
                        keyword: "format",
                        params: { format: "uuid" },
                        message: 'must match format "' + "uuid" + '"',
                      },
                    ];
                    return false;
                  }
                } else {
                  validate68.errors = [
                    {
                      instancePath: instancePath + "/id",
                      schemaPath: "#/properties/id/type",
                      keyword: "type",
                      params: { type: "string" },
                      message: "must be string",
                    },
                  ];
                  return false;
                }
              }
            }
            var valid0 = _errs2 === errors;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.attemptId !== undefined) {
              let data1 = data.attemptId;
              const _errs4 = errors;
              if (errors === _errs4) {
                if (errors === _errs4) {
                  if (typeof data1 === "string") {
                    if (!formats4.test(data1)) {
                      validate68.errors = [
                        {
                          instancePath: instancePath + "/attemptId",
                          schemaPath: "#/properties/attemptId/format",
                          keyword: "format",
                          params: { format: "uuid" },
                          message: 'must match format "' + "uuid" + '"',
                        },
                      ];
                      return false;
                    }
                  } else {
                    validate68.errors = [
                      {
                        instancePath: instancePath + "/attemptId",
                        schemaPath: "#/properties/attemptId/type",
                        keyword: "type",
                        params: { type: "string" },
                        message: "must be string",
                      },
                    ];
                    return false;
                  }
                }
              }
              var valid0 = _errs4 === errors;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.attemptRevision !== undefined) {
                let data2 = data.attemptRevision;
                const _errs6 = errors;
                if (
                  !(typeof data2 == "number" && !(data2 % 1) && !isNaN(data2))
                ) {
                  validate68.errors = [
                    {
                      instancePath: instancePath + "/attemptRevision",
                      schemaPath: "#/properties/attemptRevision/type",
                      keyword: "type",
                      params: { type: "integer" },
                      message: "must be integer",
                    },
                  ];
                  return false;
                }
                if (errors === _errs6) {
                  if (typeof data2 == "number") {
                    if (data2 > 2147483647 || isNaN(data2)) {
                      validate68.errors = [
                        {
                          instancePath: instancePath + "/attemptRevision",
                          schemaPath: "#/properties/attemptRevision/maximum",
                          keyword: "maximum",
                          params: { comparison: "<=", limit: 2147483647 },
                          message: "must be <= 2147483647",
                        },
                      ];
                      return false;
                    } else {
                      if (data2 < 0 || isNaN(data2)) {
                        validate68.errors = [
                          {
                            instancePath: instancePath + "/attemptRevision",
                            schemaPath: "#/properties/attemptRevision/minimum",
                            keyword: "minimum",
                            params: { comparison: ">=", limit: 0 },
                            message: "must be >= 0",
                          },
                        ];
                        return false;
                      } else {
                        if (!formats0.validate(data2)) {
                          validate68.errors = [
                            {
                              instancePath: instancePath + "/attemptRevision",
                              schemaPath: "#/properties/attemptRevision/format",
                              keyword: "format",
                              params: { format: "int32" },
                              message: 'must match format "' + "int32" + '"',
                            },
                          ];
                          return false;
                        }
                      }
                    }
                  }
                }
                var valid0 = _errs6 === errors;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.eventType !== undefined) {
                  let data3 = data.eventType;
                  const _errs8 = errors;
                  if (typeof data3 !== "string") {
                    validate68.errors = [
                      {
                        instancePath: instancePath + "/eventType",
                        schemaPath: "#/properties/eventType/type",
                        keyword: "type",
                        params: { type: "string" },
                        message: "must be string",
                      },
                    ];
                    return false;
                  }
                  if (
                    !(
                      data3 === "hint" ||
                      data3 === "full_solution" ||
                      data3 === "fallback" ||
                      data3 === "pause"
                    )
                  ) {
                    validate68.errors = [
                      {
                        instancePath: instancePath + "/eventType",
                        schemaPath: "#/properties/eventType/enum",
                        keyword: "enum",
                        params: {
                          allowedValues: schema80.properties.eventType.enum,
                        },
                        message: "must be equal to one of the allowed values",
                      },
                    ];
                    return false;
                  }
                  var valid0 = _errs8 === errors;
                } else {
                  var valid0 = true;
                }
                if (valid0) {
                  if (data.hintLevel !== undefined) {
                    let data4 = data.hintLevel;
                    const _errs10 = errors;
                    if (typeof data4 !== "string") {
                      validate68.errors = [
                        {
                          instancePath: instancePath + "/hintLevel",
                          schemaPath: "#/components/schemas/HintLevel/type",
                          keyword: "type",
                          params: { type: "string" },
                          message: "must be string",
                        },
                      ];
                      return false;
                    }
                    if (
                      !(
                        data4 === "H0" ||
                        data4 === "H1" ||
                        data4 === "H2" ||
                        data4 === "H3" ||
                        data4 === "H4"
                      )
                    ) {
                      validate68.errors = [
                        {
                          instancePath: instancePath + "/hintLevel",
                          schemaPath: "#/components/schemas/HintLevel/enum",
                          keyword: "enum",
                          params: { allowedValues: schema81.enum },
                          message: "must be equal to one of the allowed values",
                        },
                      ];
                      return false;
                    }
                    var valid0 = _errs10 === errors;
                  } else {
                    var valid0 = true;
                  }
                  if (valid0) {
                    if (data.textAr !== undefined) {
                      const _errs13 = errors;
                      if (typeof data.textAr !== "string") {
                        validate68.errors = [
                          {
                            instancePath: instancePath + "/textAr",
                            schemaPath: "#/properties/textAr/type",
                            keyword: "type",
                            params: { type: "string" },
                            message: "must be string",
                          },
                        ];
                        return false;
                      }
                      var valid0 = _errs13 === errors;
                    } else {
                      var valid0 = true;
                    }
                    if (valid0) {
                      if (data.solutionStepsAr !== undefined) {
                        let data6 = data.solutionStepsAr;
                        const _errs15 = errors;
                        if (errors === _errs15) {
                          if (Array.isArray(data6)) {
                            var valid2 = true;
                            const len0 = data6.length;
                            for (let i0 = 0; i0 < len0; i0++) {
                              const _errs17 = errors;
                              if (typeof data6[i0] !== "string") {
                                validate68.errors = [
                                  {
                                    instancePath:
                                      instancePath + "/solutionStepsAr/" + i0,
                                    schemaPath:
                                      "#/properties/solutionStepsAr/items/type",
                                    keyword: "type",
                                    params: { type: "string" },
                                    message: "must be string",
                                  },
                                ];
                                return false;
                              }
                              var valid2 = _errs17 === errors;
                              if (!valid2) {
                                break;
                              }
                            }
                          } else {
                            validate68.errors = [
                              {
                                instancePath: instancePath + "/solutionStepsAr",
                                schemaPath: "#/properties/solutionStepsAr/type",
                                keyword: "type",
                                params: { type: "array" },
                                message: "must be array",
                              },
                            ];
                            return false;
                          }
                        }
                        var valid0 = _errs15 === errors;
                      } else {
                        var valid0 = true;
                      }
                      if (valid0) {
                        if (data.generationSource !== undefined) {
                          let data8 = data.generationSource;
                          const _errs19 = errors;
                          if (typeof data8 !== "string") {
                            validate68.errors = [
                              {
                                instancePath:
                                  instancePath + "/generationSource",
                                schemaPath:
                                  "#/properties/generationSource/type",
                                keyword: "type",
                                params: { type: "string" },
                                message: "must be string",
                              },
                            ];
                            return false;
                          }
                          if (
                            !(
                              data8 === "reviewed_template" ||
                              data8 === "llm_validated" ||
                              data8 === "manual"
                            )
                          ) {
                            validate68.errors = [
                              {
                                instancePath:
                                  instancePath + "/generationSource",
                                schemaPath:
                                  "#/properties/generationSource/enum",
                                keyword: "enum",
                                params: {
                                  allowedValues:
                                    schema80.properties.generationSource.enum,
                                },
                                message:
                                  "must be equal to one of the allowed values",
                              },
                            ];
                            return false;
                          }
                          var valid0 = _errs19 === errors;
                        } else {
                          var valid0 = true;
                        }
                        if (valid0) {
                          if (data.independentEvidenceEligible !== undefined) {
                            const _errs21 = errors;
                            if (
                              typeof data.independentEvidenceEligible !==
                              "boolean"
                            ) {
                              validate68.errors = [
                                {
                                  instancePath:
                                    instancePath +
                                    "/independentEvidenceEligible",
                                  schemaPath:
                                    "#/properties/independentEvidenceEligible/type",
                                  keyword: "type",
                                  params: { type: "boolean" },
                                  message: "must be boolean",
                                },
                              ];
                              return false;
                            }
                            var valid0 = _errs21 === errors;
                          } else {
                            var valid0 = true;
                          }
                          if (valid0) {
                            if (data.createdAt !== undefined) {
                              let data10 = data.createdAt;
                              const _errs23 = errors;
                              if (errors === _errs23) {
                                if (errors === _errs23) {
                                  if (typeof data10 === "string") {
                                    if (!formats6.validate(data10)) {
                                      validate68.errors = [
                                        {
                                          instancePath:
                                            instancePath + "/createdAt",
                                          schemaPath:
                                            "#/properties/createdAt/format",
                                          keyword: "format",
                                          params: { format: "date-time" },
                                          message:
                                            'must match format "' +
                                            "date-time" +
                                            '"',
                                        },
                                      ];
                                      return false;
                                    }
                                  } else {
                                    validate68.errors = [
                                      {
                                        instancePath:
                                          instancePath + "/createdAt",
                                        schemaPath:
                                          "#/properties/createdAt/type",
                                        keyword: "type",
                                        params: { type: "string" },
                                        message: "must be string",
                                      },
                                    ];
                                    return false;
                                  }
                                }
                              }
                              var valid0 = _errs23 === errors;
                            } else {
                              var valid0 = true;
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    } else {
      validate68.errors = [
        {
          instancePath,
          schemaPath: "#/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        },
      ];
      return false;
    }
  }
  validate68.errors = vErrors;
  return errors === 0;
}
validate68.evaluated = {
  props: true,
  dynamicProps: false,
  dynamicItems: false,
};
function validate67(
  data,
  {
    instancePath = "",
    parentData,
    parentDataProperty,
    rootData = data,
    dynamicAnchors = {},
  } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate67.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (errors === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (
        (data.data === undefined && (missing0 = "data")) ||
        (data.meta === undefined && (missing0 = "meta"))
      ) {
        validate67.errors = [
          {
            instancePath,
            schemaPath: "#/required",
            keyword: "required",
            params: { missingProperty: missing0 },
            message: "must have required property '" + missing0 + "'",
          },
        ];
        return false;
      } else {
        const _errs1 = errors;
        for (const key0 in data) {
          if (!(key0 === "data" || key0 === "meta")) {
            validate67.errors = [
              {
                instancePath,
                schemaPath: "#/additionalProperties",
                keyword: "additionalProperties",
                params: { additionalProperty: key0 },
                message: "must NOT have additional properties",
              },
            ];
            return false;
            break;
          }
        }
        if (_errs1 === errors) {
          if (data.data !== undefined) {
            const _errs2 = errors;
            if (
              !validate68(data.data, {
                instancePath: instancePath + "/data",
                parentData: data,
                parentDataProperty: "data",
                rootData,
                dynamicAnchors,
              })
            ) {
              vErrors =
                vErrors === null
                  ? validate68.errors
                  : vErrors.concat(validate68.errors);
              errors = vErrors.length;
            }
            var valid0 = _errs2 === errors;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.meta !== undefined) {
              let data1 = data.meta;
              const _errs3 = errors;
              const _errs4 = errors;
              if (errors === _errs4) {
                if (
                  data1 &&
                  typeof data1 == "object" &&
                  !Array.isArray(data1)
                ) {
                  let missing1;
                  if (
                    (data1.requestId === undefined &&
                      (missing1 = "requestId")) ||
                    (data1.serverTime === undefined &&
                      (missing1 = "serverTime")) ||
                    (data1.apiVersion === undefined &&
                      (missing1 = "apiVersion"))
                  ) {
                    validate67.errors = [
                      {
                        instancePath: instancePath + "/meta",
                        schemaPath: "#/components/schemas/Meta/required",
                        keyword: "required",
                        params: { missingProperty: missing1 },
                        message:
                          "must have required property '" + missing1 + "'",
                      },
                    ];
                    return false;
                  } else {
                    const _errs6 = errors;
                    for (const key1 in data1) {
                      if (
                        !(
                          key1 === "requestId" ||
                          key1 === "serverTime" ||
                          key1 === "apiVersion"
                        )
                      ) {
                        validate67.errors = [
                          {
                            instancePath: instancePath + "/meta",
                            schemaPath:
                              "#/components/schemas/Meta/additionalProperties",
                            keyword: "additionalProperties",
                            params: { additionalProperty: key1 },
                            message: "must NOT have additional properties",
                          },
                        ];
                        return false;
                        break;
                      }
                    }
                    if (_errs6 === errors) {
                      if (data1.requestId !== undefined) {
                        let data2 = data1.requestId;
                        const _errs7 = errors;
                        if (errors === _errs7) {
                          if (errors === _errs7) {
                            if (typeof data2 === "string") {
                              if (!formats4.test(data2)) {
                                validate67.errors = [
                                  {
                                    instancePath:
                                      instancePath + "/meta/requestId",
                                    schemaPath:
                                      "#/components/schemas/Meta/properties/requestId/format",
                                    keyword: "format",
                                    params: { format: "uuid" },
                                    message:
                                      'must match format "' + "uuid" + '"',
                                  },
                                ];
                                return false;
                              }
                            } else {
                              validate67.errors = [
                                {
                                  instancePath:
                                    instancePath + "/meta/requestId",
                                  schemaPath:
                                    "#/components/schemas/Meta/properties/requestId/type",
                                  keyword: "type",
                                  params: { type: "string" },
                                  message: "must be string",
                                },
                              ];
                              return false;
                            }
                          }
                        }
                        var valid2 = _errs7 === errors;
                      } else {
                        var valid2 = true;
                      }
                      if (valid2) {
                        if (data1.serverTime !== undefined) {
                          let data3 = data1.serverTime;
                          const _errs9 = errors;
                          if (errors === _errs9) {
                            if (errors === _errs9) {
                              if (typeof data3 === "string") {
                                if (!formats6.validate(data3)) {
                                  validate67.errors = [
                                    {
                                      instancePath:
                                        instancePath + "/meta/serverTime",
                                      schemaPath:
                                        "#/components/schemas/Meta/properties/serverTime/format",
                                      keyword: "format",
                                      params: { format: "date-time" },
                                      message:
                                        'must match format "' +
                                        "date-time" +
                                        '"',
                                    },
                                  ];
                                  return false;
                                }
                              } else {
                                validate67.errors = [
                                  {
                                    instancePath:
                                      instancePath + "/meta/serverTime",
                                    schemaPath:
                                      "#/components/schemas/Meta/properties/serverTime/type",
                                    keyword: "type",
                                    params: { type: "string" },
                                    message: "must be string",
                                  },
                                ];
                                return false;
                              }
                            }
                          }
                          var valid2 = _errs9 === errors;
                        } else {
                          var valid2 = true;
                        }
                        if (valid2) {
                          if (data1.apiVersion !== undefined) {
                            const _errs11 = errors;
                            if (typeof data1.apiVersion !== "string") {
                              validate67.errors = [
                                {
                                  instancePath:
                                    instancePath + "/meta/apiVersion",
                                  schemaPath:
                                    "#/components/schemas/Meta/properties/apiVersion/type",
                                  keyword: "type",
                                  params: { type: "string" },
                                  message: "must be string",
                                },
                              ];
                              return false;
                            }
                            var valid2 = _errs11 === errors;
                          } else {
                            var valid2 = true;
                          }
                        }
                      }
                    }
                  }
                } else {
                  validate67.errors = [
                    {
                      instancePath: instancePath + "/meta",
                      schemaPath: "#/components/schemas/Meta/type",
                      keyword: "type",
                      params: { type: "object" },
                      message: "must be object",
                    },
                  ];
                  return false;
                }
              }
              var valid0 = _errs3 === errors;
            } else {
              var valid0 = true;
            }
          }
        }
      }
    } else {
      validate67.errors = [
        {
          instancePath,
          schemaPath: "#/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        },
      ];
      return false;
    }
  }
  validate67.errors = vErrors;
  return errors === 0;
}
validate67.evaluated = {
  props: true,
  dynamicProps: false,
  dynamicItems: false,
};
exports.ProbeAnswerEnvelope = validate70;
const schema83 = {
  type: "object",
  additionalProperties: false,
  properties: {
    data: { $ref: "#/components/schemas/ProbeEvaluation" },
    meta: { $ref: "#/components/schemas/Meta" },
  },
  required: ["data", "meta"],
};
const schema84 = {
  type: "object",
  additionalProperties: false,
  properties: {
    probeId: { type: "string", format: "uuid" },
    attemptId: { type: "string", format: "uuid" },
    attemptRevision: {
      type: "integer",
      format: "int32",
      description:
        "إصدار محاولة، يعادل bigint في PostgreSQL لكنه مقيد هنا إلى Int32 آمن لواجهات JavaScript.",
      minimum: 0,
      maximum: 2147483647,
      example: 4,
    },
    evaluation: {
      type: "string",
      enum: ["supported", "not_supported", "unclear", "unverified"],
    },
    diagnosis: {
      anyOf: [
        { $ref: "#/components/schemas/DiagnosisCandidate" },
        { type: "null" },
      ],
    },
    feedbackAr: { type: "string" },
    nextAction: {
      type: "string",
      enum: ["hint", "remediation", "continue", "clarify"],
    },
  },
  required: [
    "probeId",
    "attemptId",
    "attemptRevision",
    "evaluation",
    "diagnosis",
    "feedbackAr",
    "nextAction",
  ],
};
function validate71(
  data,
  {
    instancePath = "",
    parentData,
    parentDataProperty,
    rootData = data,
    dynamicAnchors = {},
  } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate71.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (errors === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (
        (data.probeId === undefined && (missing0 = "probeId")) ||
        (data.attemptId === undefined && (missing0 = "attemptId")) ||
        (data.attemptRevision === undefined &&
          (missing0 = "attemptRevision")) ||
        (data.evaluation === undefined && (missing0 = "evaluation")) ||
        (data.diagnosis === undefined && (missing0 = "diagnosis")) ||
        (data.feedbackAr === undefined && (missing0 = "feedbackAr")) ||
        (data.nextAction === undefined && (missing0 = "nextAction"))
      ) {
        validate71.errors = [
          {
            instancePath,
            schemaPath: "#/required",
            keyword: "required",
            params: { missingProperty: missing0 },
            message: "must have required property '" + missing0 + "'",
          },
        ];
        return false;
      } else {
        const _errs1 = errors;
        for (const key0 in data) {
          if (
            !(
              key0 === "probeId" ||
              key0 === "attemptId" ||
              key0 === "attemptRevision" ||
              key0 === "evaluation" ||
              key0 === "diagnosis" ||
              key0 === "feedbackAr" ||
              key0 === "nextAction"
            )
          ) {
            validate71.errors = [
              {
                instancePath,
                schemaPath: "#/additionalProperties",
                keyword: "additionalProperties",
                params: { additionalProperty: key0 },
                message: "must NOT have additional properties",
              },
            ];
            return false;
            break;
          }
        }
        if (_errs1 === errors) {
          if (data.probeId !== undefined) {
            let data0 = data.probeId;
            const _errs2 = errors;
            if (errors === _errs2) {
              if (errors === _errs2) {
                if (typeof data0 === "string") {
                  if (!formats4.test(data0)) {
                    validate71.errors = [
                      {
                        instancePath: instancePath + "/probeId",
                        schemaPath: "#/properties/probeId/format",
                        keyword: "format",
                        params: { format: "uuid" },
                        message: 'must match format "' + "uuid" + '"',
                      },
                    ];
                    return false;
                  }
                } else {
                  validate71.errors = [
                    {
                      instancePath: instancePath + "/probeId",
                      schemaPath: "#/properties/probeId/type",
                      keyword: "type",
                      params: { type: "string" },
                      message: "must be string",
                    },
                  ];
                  return false;
                }
              }
            }
            var valid0 = _errs2 === errors;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.attemptId !== undefined) {
              let data1 = data.attemptId;
              const _errs4 = errors;
              if (errors === _errs4) {
                if (errors === _errs4) {
                  if (typeof data1 === "string") {
                    if (!formats4.test(data1)) {
                      validate71.errors = [
                        {
                          instancePath: instancePath + "/attemptId",
                          schemaPath: "#/properties/attemptId/format",
                          keyword: "format",
                          params: { format: "uuid" },
                          message: 'must match format "' + "uuid" + '"',
                        },
                      ];
                      return false;
                    }
                  } else {
                    validate71.errors = [
                      {
                        instancePath: instancePath + "/attemptId",
                        schemaPath: "#/properties/attemptId/type",
                        keyword: "type",
                        params: { type: "string" },
                        message: "must be string",
                      },
                    ];
                    return false;
                  }
                }
              }
              var valid0 = _errs4 === errors;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.attemptRevision !== undefined) {
                let data2 = data.attemptRevision;
                const _errs6 = errors;
                if (
                  !(typeof data2 == "number" && !(data2 % 1) && !isNaN(data2))
                ) {
                  validate71.errors = [
                    {
                      instancePath: instancePath + "/attemptRevision",
                      schemaPath: "#/properties/attemptRevision/type",
                      keyword: "type",
                      params: { type: "integer" },
                      message: "must be integer",
                    },
                  ];
                  return false;
                }
                if (errors === _errs6) {
                  if (typeof data2 == "number") {
                    if (data2 > 2147483647 || isNaN(data2)) {
                      validate71.errors = [
                        {
                          instancePath: instancePath + "/attemptRevision",
                          schemaPath: "#/properties/attemptRevision/maximum",
                          keyword: "maximum",
                          params: { comparison: "<=", limit: 2147483647 },
                          message: "must be <= 2147483647",
                        },
                      ];
                      return false;
                    } else {
                      if (data2 < 0 || isNaN(data2)) {
                        validate71.errors = [
                          {
                            instancePath: instancePath + "/attemptRevision",
                            schemaPath: "#/properties/attemptRevision/minimum",
                            keyword: "minimum",
                            params: { comparison: ">=", limit: 0 },
                            message: "must be >= 0",
                          },
                        ];
                        return false;
                      } else {
                        if (!formats0.validate(data2)) {
                          validate71.errors = [
                            {
                              instancePath: instancePath + "/attemptRevision",
                              schemaPath: "#/properties/attemptRevision/format",
                              keyword: "format",
                              params: { format: "int32" },
                              message: 'must match format "' + "int32" + '"',
                            },
                          ];
                          return false;
                        }
                      }
                    }
                  }
                }
                var valid0 = _errs6 === errors;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.evaluation !== undefined) {
                  let data3 = data.evaluation;
                  const _errs8 = errors;
                  if (typeof data3 !== "string") {
                    validate71.errors = [
                      {
                        instancePath: instancePath + "/evaluation",
                        schemaPath: "#/properties/evaluation/type",
                        keyword: "type",
                        params: { type: "string" },
                        message: "must be string",
                      },
                    ];
                    return false;
                  }
                  if (
                    !(
                      data3 === "supported" ||
                      data3 === "not_supported" ||
                      data3 === "unclear" ||
                      data3 === "unverified"
                    )
                  ) {
                    validate71.errors = [
                      {
                        instancePath: instancePath + "/evaluation",
                        schemaPath: "#/properties/evaluation/enum",
                        keyword: "enum",
                        params: {
                          allowedValues: schema84.properties.evaluation.enum,
                        },
                        message: "must be equal to one of the allowed values",
                      },
                    ];
                    return false;
                  }
                  var valid0 = _errs8 === errors;
                } else {
                  var valid0 = true;
                }
                if (valid0) {
                  if (data.diagnosis !== undefined) {
                    let data4 = data.diagnosis;
                    const _errs10 = errors;
                    const _errs11 = errors;
                    let valid1 = false;
                    const _errs12 = errors;
                    if (
                      !validate39(data4, {
                        instancePath: instancePath + "/diagnosis",
                        parentData: data,
                        parentDataProperty: "diagnosis",
                        rootData,
                        dynamicAnchors,
                      })
                    ) {
                      vErrors =
                        vErrors === null
                          ? validate39.errors
                          : vErrors.concat(validate39.errors);
                      errors = vErrors.length;
                    }
                    var _valid0 = _errs12 === errors;
                    valid1 = valid1 || _valid0;
                    const _errs13 = errors;
                    if (data4 !== null) {
                      const err0 = {
                        instancePath: instancePath + "/diagnosis",
                        schemaPath: "#/properties/diagnosis/anyOf/1/type",
                        keyword: "type",
                        params: { type: "null" },
                        message: "must be null",
                      };
                      if (vErrors === null) {
                        vErrors = [err0];
                      } else {
                        vErrors.push(err0);
                      }
                      errors++;
                    }
                    var _valid0 = _errs13 === errors;
                    valid1 = valid1 || _valid0;
                    if (!valid1) {
                      const err1 = {
                        instancePath: instancePath + "/diagnosis",
                        schemaPath: "#/properties/diagnosis/anyOf",
                        keyword: "anyOf",
                        params: {},
                        message: "must match a schema in anyOf",
                      };
                      if (vErrors === null) {
                        vErrors = [err1];
                      } else {
                        vErrors.push(err1);
                      }
                      errors++;
                      validate71.errors = vErrors;
                      return false;
                    } else {
                      errors = _errs11;
                      if (vErrors !== null) {
                        if (_errs11) {
                          vErrors.length = _errs11;
                        } else {
                          vErrors = null;
                        }
                      }
                    }
                    var valid0 = _errs10 === errors;
                  } else {
                    var valid0 = true;
                  }
                  if (valid0) {
                    if (data.feedbackAr !== undefined) {
                      const _errs15 = errors;
                      if (typeof data.feedbackAr !== "string") {
                        validate71.errors = [
                          {
                            instancePath: instancePath + "/feedbackAr",
                            schemaPath: "#/properties/feedbackAr/type",
                            keyword: "type",
                            params: { type: "string" },
                            message: "must be string",
                          },
                        ];
                        return false;
                      }
                      var valid0 = _errs15 === errors;
                    } else {
                      var valid0 = true;
                    }
                    if (valid0) {
                      if (data.nextAction !== undefined) {
                        let data6 = data.nextAction;
                        const _errs17 = errors;
                        if (typeof data6 !== "string") {
                          validate71.errors = [
                            {
                              instancePath: instancePath + "/nextAction",
                              schemaPath: "#/properties/nextAction/type",
                              keyword: "type",
                              params: { type: "string" },
                              message: "must be string",
                            },
                          ];
                          return false;
                        }
                        if (
                          !(
                            data6 === "hint" ||
                            data6 === "remediation" ||
                            data6 === "continue" ||
                            data6 === "clarify"
                          )
                        ) {
                          validate71.errors = [
                            {
                              instancePath: instancePath + "/nextAction",
                              schemaPath: "#/properties/nextAction/enum",
                              keyword: "enum",
                              params: {
                                allowedValues:
                                  schema84.properties.nextAction.enum,
                              },
                              message:
                                "must be equal to one of the allowed values",
                            },
                          ];
                          return false;
                        }
                        var valid0 = _errs17 === errors;
                      } else {
                        var valid0 = true;
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    } else {
      validate71.errors = [
        {
          instancePath,
          schemaPath: "#/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        },
      ];
      return false;
    }
  }
  validate71.errors = vErrors;
  return errors === 0;
}
validate71.evaluated = {
  props: true,
  dynamicProps: false,
  dynamicItems: false,
};
function validate70(
  data,
  {
    instancePath = "",
    parentData,
    parentDataProperty,
    rootData = data,
    dynamicAnchors = {},
  } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate70.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (errors === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (
        (data.data === undefined && (missing0 = "data")) ||
        (data.meta === undefined && (missing0 = "meta"))
      ) {
        validate70.errors = [
          {
            instancePath,
            schemaPath: "#/required",
            keyword: "required",
            params: { missingProperty: missing0 },
            message: "must have required property '" + missing0 + "'",
          },
        ];
        return false;
      } else {
        const _errs1 = errors;
        for (const key0 in data) {
          if (!(key0 === "data" || key0 === "meta")) {
            validate70.errors = [
              {
                instancePath,
                schemaPath: "#/additionalProperties",
                keyword: "additionalProperties",
                params: { additionalProperty: key0 },
                message: "must NOT have additional properties",
              },
            ];
            return false;
            break;
          }
        }
        if (_errs1 === errors) {
          if (data.data !== undefined) {
            const _errs2 = errors;
            if (
              !validate71(data.data, {
                instancePath: instancePath + "/data",
                parentData: data,
                parentDataProperty: "data",
                rootData,
                dynamicAnchors,
              })
            ) {
              vErrors =
                vErrors === null
                  ? validate71.errors
                  : vErrors.concat(validate71.errors);
              errors = vErrors.length;
            }
            var valid0 = _errs2 === errors;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.meta !== undefined) {
              let data1 = data.meta;
              const _errs3 = errors;
              const _errs4 = errors;
              if (errors === _errs4) {
                if (
                  data1 &&
                  typeof data1 == "object" &&
                  !Array.isArray(data1)
                ) {
                  let missing1;
                  if (
                    (data1.requestId === undefined &&
                      (missing1 = "requestId")) ||
                    (data1.serverTime === undefined &&
                      (missing1 = "serverTime")) ||
                    (data1.apiVersion === undefined &&
                      (missing1 = "apiVersion"))
                  ) {
                    validate70.errors = [
                      {
                        instancePath: instancePath + "/meta",
                        schemaPath: "#/components/schemas/Meta/required",
                        keyword: "required",
                        params: { missingProperty: missing1 },
                        message:
                          "must have required property '" + missing1 + "'",
                      },
                    ];
                    return false;
                  } else {
                    const _errs6 = errors;
                    for (const key1 in data1) {
                      if (
                        !(
                          key1 === "requestId" ||
                          key1 === "serverTime" ||
                          key1 === "apiVersion"
                        )
                      ) {
                        validate70.errors = [
                          {
                            instancePath: instancePath + "/meta",
                            schemaPath:
                              "#/components/schemas/Meta/additionalProperties",
                            keyword: "additionalProperties",
                            params: { additionalProperty: key1 },
                            message: "must NOT have additional properties",
                          },
                        ];
                        return false;
                        break;
                      }
                    }
                    if (_errs6 === errors) {
                      if (data1.requestId !== undefined) {
                        let data2 = data1.requestId;
                        const _errs7 = errors;
                        if (errors === _errs7) {
                          if (errors === _errs7) {
                            if (typeof data2 === "string") {
                              if (!formats4.test(data2)) {
                                validate70.errors = [
                                  {
                                    instancePath:
                                      instancePath + "/meta/requestId",
                                    schemaPath:
                                      "#/components/schemas/Meta/properties/requestId/format",
                                    keyword: "format",
                                    params: { format: "uuid" },
                                    message:
                                      'must match format "' + "uuid" + '"',
                                  },
                                ];
                                return false;
                              }
                            } else {
                              validate70.errors = [
                                {
                                  instancePath:
                                    instancePath + "/meta/requestId",
                                  schemaPath:
                                    "#/components/schemas/Meta/properties/requestId/type",
                                  keyword: "type",
                                  params: { type: "string" },
                                  message: "must be string",
                                },
                              ];
                              return false;
                            }
                          }
                        }
                        var valid2 = _errs7 === errors;
                      } else {
                        var valid2 = true;
                      }
                      if (valid2) {
                        if (data1.serverTime !== undefined) {
                          let data3 = data1.serverTime;
                          const _errs9 = errors;
                          if (errors === _errs9) {
                            if (errors === _errs9) {
                              if (typeof data3 === "string") {
                                if (!formats6.validate(data3)) {
                                  validate70.errors = [
                                    {
                                      instancePath:
                                        instancePath + "/meta/serverTime",
                                      schemaPath:
                                        "#/components/schemas/Meta/properties/serverTime/format",
                                      keyword: "format",
                                      params: { format: "date-time" },
                                      message:
                                        'must match format "' +
                                        "date-time" +
                                        '"',
                                    },
                                  ];
                                  return false;
                                }
                              } else {
                                validate70.errors = [
                                  {
                                    instancePath:
                                      instancePath + "/meta/serverTime",
                                    schemaPath:
                                      "#/components/schemas/Meta/properties/serverTime/type",
                                    keyword: "type",
                                    params: { type: "string" },
                                    message: "must be string",
                                  },
                                ];
                                return false;
                              }
                            }
                          }
                          var valid2 = _errs9 === errors;
                        } else {
                          var valid2 = true;
                        }
                        if (valid2) {
                          if (data1.apiVersion !== undefined) {
                            const _errs11 = errors;
                            if (typeof data1.apiVersion !== "string") {
                              validate70.errors = [
                                {
                                  instancePath:
                                    instancePath + "/meta/apiVersion",
                                  schemaPath:
                                    "#/components/schemas/Meta/properties/apiVersion/type",
                                  keyword: "type",
                                  params: { type: "string" },
                                  message: "must be string",
                                },
                              ];
                              return false;
                            }
                            var valid2 = _errs11 === errors;
                          } else {
                            var valid2 = true;
                          }
                        }
                      }
                    }
                  }
                } else {
                  validate70.errors = [
                    {
                      instancePath: instancePath + "/meta",
                      schemaPath: "#/components/schemas/Meta/type",
                      keyword: "type",
                      params: { type: "object" },
                      message: "must be object",
                    },
                  ];
                  return false;
                }
              }
              var valid0 = _errs3 === errors;
            } else {
              var valid0 = true;
            }
          }
        }
      }
    } else {
      validate70.errors = [
        {
          instancePath,
          schemaPath: "#/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        },
      ];
      return false;
    }
  }
  validate70.errors = vErrors;
  return errors === 0;
}
validate70.evaluated = {
  props: true,
  dynamicProps: false,
  dynamicItems: false,
};
exports.ProbeEnvelope = validate74;
const schema86 = {
  type: "object",
  additionalProperties: false,
  properties: {
    data: { $ref: "#/components/schemas/Probe" },
    meta: { $ref: "#/components/schemas/Meta" },
  },
  required: ["data", "meta"],
};
const schema87 = {
  type: "object",
  additionalProperties: false,
  description: "لا تُرسل الإجابة الصحيحة إلى الطالب قبل إرسال الإجابة.",
  properties: {
    id: { type: "string", format: "uuid" },
    attemptId: { type: "string", format: "uuid" },
    attemptRevision: {
      type: "integer",
      format: "int32",
      description:
        "إصدار محاولة، يعادل bigint في PostgreSQL لكنه مقيد هنا إلى Int32 آمن لواجهات JavaScript.",
      minimum: 0,
      maximum: 2147483647,
      example: 4,
    },
    diagnosisId: {
      anyOf: [{ type: "string", format: "uuid" }, { type: "null" }],
    },
    questionAr: { type: "string" },
    responseMode: { type: "string", enum: ["choice", "text"] },
    options: {
      type: "array",
      items: { $ref: "#/components/schemas/ProbeOption" },
    },
    status: { type: "string", enum: ["open", "answered", "cancelled"] },
  },
  required: [
    "id",
    "attemptId",
    "attemptRevision",
    "diagnosisId",
    "questionAr",
    "responseMode",
    "options",
    "status",
  ],
};
const schema88 = {
  type: "object",
  additionalProperties: false,
  properties: {
    id: { type: "string", maxLength: 64 },
    labelAr: { type: "string", maxLength: 300 },
  },
  required: ["id", "labelAr"],
};
function validate75(
  data,
  {
    instancePath = "",
    parentData,
    parentDataProperty,
    rootData = data,
    dynamicAnchors = {},
  } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate75.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (errors === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (
        (data.id === undefined && (missing0 = "id")) ||
        (data.attemptId === undefined && (missing0 = "attemptId")) ||
        (data.attemptRevision === undefined &&
          (missing0 = "attemptRevision")) ||
        (data.diagnosisId === undefined && (missing0 = "diagnosisId")) ||
        (data.questionAr === undefined && (missing0 = "questionAr")) ||
        (data.responseMode === undefined && (missing0 = "responseMode")) ||
        (data.options === undefined && (missing0 = "options")) ||
        (data.status === undefined && (missing0 = "status"))
      ) {
        validate75.errors = [
          {
            instancePath,
            schemaPath: "#/required",
            keyword: "required",
            params: { missingProperty: missing0 },
            message: "must have required property '" + missing0 + "'",
          },
        ];
        return false;
      } else {
        const _errs1 = errors;
        for (const key0 in data) {
          if (
            !(
              key0 === "id" ||
              key0 === "attemptId" ||
              key0 === "attemptRevision" ||
              key0 === "diagnosisId" ||
              key0 === "questionAr" ||
              key0 === "responseMode" ||
              key0 === "options" ||
              key0 === "status"
            )
          ) {
            validate75.errors = [
              {
                instancePath,
                schemaPath: "#/additionalProperties",
                keyword: "additionalProperties",
                params: { additionalProperty: key0 },
                message: "must NOT have additional properties",
              },
            ];
            return false;
            break;
          }
        }
        if (_errs1 === errors) {
          if (data.id !== undefined) {
            let data0 = data.id;
            const _errs2 = errors;
            if (errors === _errs2) {
              if (errors === _errs2) {
                if (typeof data0 === "string") {
                  if (!formats4.test(data0)) {
                    validate75.errors = [
                      {
                        instancePath: instancePath + "/id",
                        schemaPath: "#/properties/id/format",
                        keyword: "format",
                        params: { format: "uuid" },
                        message: 'must match format "' + "uuid" + '"',
                      },
                    ];
                    return false;
                  }
                } else {
                  validate75.errors = [
                    {
                      instancePath: instancePath + "/id",
                      schemaPath: "#/properties/id/type",
                      keyword: "type",
                      params: { type: "string" },
                      message: "must be string",
                    },
                  ];
                  return false;
                }
              }
            }
            var valid0 = _errs2 === errors;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.attemptId !== undefined) {
              let data1 = data.attemptId;
              const _errs4 = errors;
              if (errors === _errs4) {
                if (errors === _errs4) {
                  if (typeof data1 === "string") {
                    if (!formats4.test(data1)) {
                      validate75.errors = [
                        {
                          instancePath: instancePath + "/attemptId",
                          schemaPath: "#/properties/attemptId/format",
                          keyword: "format",
                          params: { format: "uuid" },
                          message: 'must match format "' + "uuid" + '"',
                        },
                      ];
                      return false;
                    }
                  } else {
                    validate75.errors = [
                      {
                        instancePath: instancePath + "/attemptId",
                        schemaPath: "#/properties/attemptId/type",
                        keyword: "type",
                        params: { type: "string" },
                        message: "must be string",
                      },
                    ];
                    return false;
                  }
                }
              }
              var valid0 = _errs4 === errors;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.attemptRevision !== undefined) {
                let data2 = data.attemptRevision;
                const _errs6 = errors;
                if (
                  !(typeof data2 == "number" && !(data2 % 1) && !isNaN(data2))
                ) {
                  validate75.errors = [
                    {
                      instancePath: instancePath + "/attemptRevision",
                      schemaPath: "#/properties/attemptRevision/type",
                      keyword: "type",
                      params: { type: "integer" },
                      message: "must be integer",
                    },
                  ];
                  return false;
                }
                if (errors === _errs6) {
                  if (typeof data2 == "number") {
                    if (data2 > 2147483647 || isNaN(data2)) {
                      validate75.errors = [
                        {
                          instancePath: instancePath + "/attemptRevision",
                          schemaPath: "#/properties/attemptRevision/maximum",
                          keyword: "maximum",
                          params: { comparison: "<=", limit: 2147483647 },
                          message: "must be <= 2147483647",
                        },
                      ];
                      return false;
                    } else {
                      if (data2 < 0 || isNaN(data2)) {
                        validate75.errors = [
                          {
                            instancePath: instancePath + "/attemptRevision",
                            schemaPath: "#/properties/attemptRevision/minimum",
                            keyword: "minimum",
                            params: { comparison: ">=", limit: 0 },
                            message: "must be >= 0",
                          },
                        ];
                        return false;
                      } else {
                        if (!formats0.validate(data2)) {
                          validate75.errors = [
                            {
                              instancePath: instancePath + "/attemptRevision",
                              schemaPath: "#/properties/attemptRevision/format",
                              keyword: "format",
                              params: { format: "int32" },
                              message: 'must match format "' + "int32" + '"',
                            },
                          ];
                          return false;
                        }
                      }
                    }
                  }
                }
                var valid0 = _errs6 === errors;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.diagnosisId !== undefined) {
                  let data3 = data.diagnosisId;
                  const _errs8 = errors;
                  const _errs9 = errors;
                  let valid1 = false;
                  const _errs10 = errors;
                  if (errors === _errs10) {
                    if (errors === _errs10) {
                      if (typeof data3 === "string") {
                        if (!formats4.test(data3)) {
                          const err0 = {
                            instancePath: instancePath + "/diagnosisId",
                            schemaPath:
                              "#/properties/diagnosisId/anyOf/0/format",
                            keyword: "format",
                            params: { format: "uuid" },
                            message: 'must match format "' + "uuid" + '"',
                          };
                          if (vErrors === null) {
                            vErrors = [err0];
                          } else {
                            vErrors.push(err0);
                          }
                          errors++;
                        }
                      } else {
                        const err1 = {
                          instancePath: instancePath + "/diagnosisId",
                          schemaPath: "#/properties/diagnosisId/anyOf/0/type",
                          keyword: "type",
                          params: { type: "string" },
                          message: "must be string",
                        };
                        if (vErrors === null) {
                          vErrors = [err1];
                        } else {
                          vErrors.push(err1);
                        }
                        errors++;
                      }
                    }
                  }
                  var _valid0 = _errs10 === errors;
                  valid1 = valid1 || _valid0;
                  const _errs12 = errors;
                  if (data3 !== null) {
                    const err2 = {
                      instancePath: instancePath + "/diagnosisId",
                      schemaPath: "#/properties/diagnosisId/anyOf/1/type",
                      keyword: "type",
                      params: { type: "null" },
                      message: "must be null",
                    };
                    if (vErrors === null) {
                      vErrors = [err2];
                    } else {
                      vErrors.push(err2);
                    }
                    errors++;
                  }
                  var _valid0 = _errs12 === errors;
                  valid1 = valid1 || _valid0;
                  if (!valid1) {
                    const err3 = {
                      instancePath: instancePath + "/diagnosisId",
                      schemaPath: "#/properties/diagnosisId/anyOf",
                      keyword: "anyOf",
                      params: {},
                      message: "must match a schema in anyOf",
                    };
                    if (vErrors === null) {
                      vErrors = [err3];
                    } else {
                      vErrors.push(err3);
                    }
                    errors++;
                    validate75.errors = vErrors;
                    return false;
                  } else {
                    errors = _errs9;
                    if (vErrors !== null) {
                      if (_errs9) {
                        vErrors.length = _errs9;
                      } else {
                        vErrors = null;
                      }
                    }
                  }
                  var valid0 = _errs8 === errors;
                } else {
                  var valid0 = true;
                }
                if (valid0) {
                  if (data.questionAr !== undefined) {
                    const _errs14 = errors;
                    if (typeof data.questionAr !== "string") {
                      validate75.errors = [
                        {
                          instancePath: instancePath + "/questionAr",
                          schemaPath: "#/properties/questionAr/type",
                          keyword: "type",
                          params: { type: "string" },
                          message: "must be string",
                        },
                      ];
                      return false;
                    }
                    var valid0 = _errs14 === errors;
                  } else {
                    var valid0 = true;
                  }
                  if (valid0) {
                    if (data.responseMode !== undefined) {
                      let data5 = data.responseMode;
                      const _errs16 = errors;
                      if (typeof data5 !== "string") {
                        validate75.errors = [
                          {
                            instancePath: instancePath + "/responseMode",
                            schemaPath: "#/properties/responseMode/type",
                            keyword: "type",
                            params: { type: "string" },
                            message: "must be string",
                          },
                        ];
                        return false;
                      }
                      if (!(data5 === "choice" || data5 === "text")) {
                        validate75.errors = [
                          {
                            instancePath: instancePath + "/responseMode",
                            schemaPath: "#/properties/responseMode/enum",
                            keyword: "enum",
                            params: {
                              allowedValues:
                                schema87.properties.responseMode.enum,
                            },
                            message:
                              "must be equal to one of the allowed values",
                          },
                        ];
                        return false;
                      }
                      var valid0 = _errs16 === errors;
                    } else {
                      var valid0 = true;
                    }
                    if (valid0) {
                      if (data.options !== undefined) {
                        let data6 = data.options;
                        const _errs18 = errors;
                        if (errors === _errs18) {
                          if (Array.isArray(data6)) {
                            var valid2 = true;
                            const len0 = data6.length;
                            for (let i0 = 0; i0 < len0; i0++) {
                              let data7 = data6[i0];
                              const _errs20 = errors;
                              const _errs21 = errors;
                              if (errors === _errs21) {
                                if (
                                  data7 &&
                                  typeof data7 == "object" &&
                                  !Array.isArray(data7)
                                ) {
                                  let missing1;
                                  if (
                                    (data7.id === undefined &&
                                      (missing1 = "id")) ||
                                    (data7.labelAr === undefined &&
                                      (missing1 = "labelAr"))
                                  ) {
                                    validate75.errors = [
                                      {
                                        instancePath:
                                          instancePath + "/options/" + i0,
                                        schemaPath:
                                          "#/components/schemas/ProbeOption/required",
                                        keyword: "required",
                                        params: { missingProperty: missing1 },
                                        message:
                                          "must have required property '" +
                                          missing1 +
                                          "'",
                                      },
                                    ];
                                    return false;
                                  } else {
                                    const _errs23 = errors;
                                    for (const key1 in data7) {
                                      if (
                                        !(key1 === "id" || key1 === "labelAr")
                                      ) {
                                        validate75.errors = [
                                          {
                                            instancePath:
                                              instancePath + "/options/" + i0,
                                            schemaPath:
                                              "#/components/schemas/ProbeOption/additionalProperties",
                                            keyword: "additionalProperties",
                                            params: {
                                              additionalProperty: key1,
                                            },
                                            message:
                                              "must NOT have additional properties",
                                          },
                                        ];
                                        return false;
                                        break;
                                      }
                                    }
                                    if (_errs23 === errors) {
                                      if (data7.id !== undefined) {
                                        let data8 = data7.id;
                                        const _errs24 = errors;
                                        if (errors === _errs24) {
                                          if (typeof data8 === "string") {
                                            if (func2(data8) > 64) {
                                              validate75.errors = [
                                                {
                                                  instancePath:
                                                    instancePath +
                                                    "/options/" +
                                                    i0 +
                                                    "/id",
                                                  schemaPath:
                                                    "#/components/schemas/ProbeOption/properties/id/maxLength",
                                                  keyword: "maxLength",
                                                  params: { limit: 64 },
                                                  message:
                                                    "must NOT have more than 64 characters",
                                                },
                                              ];
                                              return false;
                                            }
                                          } else {
                                            validate75.errors = [
                                              {
                                                instancePath:
                                                  instancePath +
                                                  "/options/" +
                                                  i0 +
                                                  "/id",
                                                schemaPath:
                                                  "#/components/schemas/ProbeOption/properties/id/type",
                                                keyword: "type",
                                                params: { type: "string" },
                                                message: "must be string",
                                              },
                                            ];
                                            return false;
                                          }
                                        }
                                        var valid4 = _errs24 === errors;
                                      } else {
                                        var valid4 = true;
                                      }
                                      if (valid4) {
                                        if (data7.labelAr !== undefined) {
                                          let data9 = data7.labelAr;
                                          const _errs26 = errors;
                                          if (errors === _errs26) {
                                            if (typeof data9 === "string") {
                                              if (func2(data9) > 300) {
                                                validate75.errors = [
                                                  {
                                                    instancePath:
                                                      instancePath +
                                                      "/options/" +
                                                      i0 +
                                                      "/labelAr",
                                                    schemaPath:
                                                      "#/components/schemas/ProbeOption/properties/labelAr/maxLength",
                                                    keyword: "maxLength",
                                                    params: { limit: 300 },
                                                    message:
                                                      "must NOT have more than 300 characters",
                                                  },
                                                ];
                                                return false;
                                              }
                                            } else {
                                              validate75.errors = [
                                                {
                                                  instancePath:
                                                    instancePath +
                                                    "/options/" +
                                                    i0 +
                                                    "/labelAr",
                                                  schemaPath:
                                                    "#/components/schemas/ProbeOption/properties/labelAr/type",
                                                  keyword: "type",
                                                  params: { type: "string" },
                                                  message: "must be string",
                                                },
                                              ];
                                              return false;
                                            }
                                          }
                                          var valid4 = _errs26 === errors;
                                        } else {
                                          var valid4 = true;
                                        }
                                      }
                                    }
                                  }
                                } else {
                                  validate75.errors = [
                                    {
                                      instancePath:
                                        instancePath + "/options/" + i0,
                                      schemaPath:
                                        "#/components/schemas/ProbeOption/type",
                                      keyword: "type",
                                      params: { type: "object" },
                                      message: "must be object",
                                    },
                                  ];
                                  return false;
                                }
                              }
                              var valid2 = _errs20 === errors;
                              if (!valid2) {
                                break;
                              }
                            }
                          } else {
                            validate75.errors = [
                              {
                                instancePath: instancePath + "/options",
                                schemaPath: "#/properties/options/type",
                                keyword: "type",
                                params: { type: "array" },
                                message: "must be array",
                              },
                            ];
                            return false;
                          }
                        }
                        var valid0 = _errs18 === errors;
                      } else {
                        var valid0 = true;
                      }
                      if (valid0) {
                        if (data.status !== undefined) {
                          let data10 = data.status;
                          const _errs28 = errors;
                          if (typeof data10 !== "string") {
                            validate75.errors = [
                              {
                                instancePath: instancePath + "/status",
                                schemaPath: "#/properties/status/type",
                                keyword: "type",
                                params: { type: "string" },
                                message: "must be string",
                              },
                            ];
                            return false;
                          }
                          if (
                            !(
                              data10 === "open" ||
                              data10 === "answered" ||
                              data10 === "cancelled"
                            )
                          ) {
                            validate75.errors = [
                              {
                                instancePath: instancePath + "/status",
                                schemaPath: "#/properties/status/enum",
                                keyword: "enum",
                                params: {
                                  allowedValues:
                                    schema87.properties.status.enum,
                                },
                                message:
                                  "must be equal to one of the allowed values",
                              },
                            ];
                            return false;
                          }
                          var valid0 = _errs28 === errors;
                        } else {
                          var valid0 = true;
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    } else {
      validate75.errors = [
        {
          instancePath,
          schemaPath: "#/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        },
      ];
      return false;
    }
  }
  validate75.errors = vErrors;
  return errors === 0;
}
validate75.evaluated = {
  props: true,
  dynamicProps: false,
  dynamicItems: false,
};
function validate74(
  data,
  {
    instancePath = "",
    parentData,
    parentDataProperty,
    rootData = data,
    dynamicAnchors = {},
  } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate74.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (errors === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (
        (data.data === undefined && (missing0 = "data")) ||
        (data.meta === undefined && (missing0 = "meta"))
      ) {
        validate74.errors = [
          {
            instancePath,
            schemaPath: "#/required",
            keyword: "required",
            params: { missingProperty: missing0 },
            message: "must have required property '" + missing0 + "'",
          },
        ];
        return false;
      } else {
        const _errs1 = errors;
        for (const key0 in data) {
          if (!(key0 === "data" || key0 === "meta")) {
            validate74.errors = [
              {
                instancePath,
                schemaPath: "#/additionalProperties",
                keyword: "additionalProperties",
                params: { additionalProperty: key0 },
                message: "must NOT have additional properties",
              },
            ];
            return false;
            break;
          }
        }
        if (_errs1 === errors) {
          if (data.data !== undefined) {
            const _errs2 = errors;
            if (
              !validate75(data.data, {
                instancePath: instancePath + "/data",
                parentData: data,
                parentDataProperty: "data",
                rootData,
                dynamicAnchors,
              })
            ) {
              vErrors =
                vErrors === null
                  ? validate75.errors
                  : vErrors.concat(validate75.errors);
              errors = vErrors.length;
            }
            var valid0 = _errs2 === errors;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.meta !== undefined) {
              let data1 = data.meta;
              const _errs3 = errors;
              const _errs4 = errors;
              if (errors === _errs4) {
                if (
                  data1 &&
                  typeof data1 == "object" &&
                  !Array.isArray(data1)
                ) {
                  let missing1;
                  if (
                    (data1.requestId === undefined &&
                      (missing1 = "requestId")) ||
                    (data1.serverTime === undefined &&
                      (missing1 = "serverTime")) ||
                    (data1.apiVersion === undefined &&
                      (missing1 = "apiVersion"))
                  ) {
                    validate74.errors = [
                      {
                        instancePath: instancePath + "/meta",
                        schemaPath: "#/components/schemas/Meta/required",
                        keyword: "required",
                        params: { missingProperty: missing1 },
                        message:
                          "must have required property '" + missing1 + "'",
                      },
                    ];
                    return false;
                  } else {
                    const _errs6 = errors;
                    for (const key1 in data1) {
                      if (
                        !(
                          key1 === "requestId" ||
                          key1 === "serverTime" ||
                          key1 === "apiVersion"
                        )
                      ) {
                        validate74.errors = [
                          {
                            instancePath: instancePath + "/meta",
                            schemaPath:
                              "#/components/schemas/Meta/additionalProperties",
                            keyword: "additionalProperties",
                            params: { additionalProperty: key1 },
                            message: "must NOT have additional properties",
                          },
                        ];
                        return false;
                        break;
                      }
                    }
                    if (_errs6 === errors) {
                      if (data1.requestId !== undefined) {
                        let data2 = data1.requestId;
                        const _errs7 = errors;
                        if (errors === _errs7) {
                          if (errors === _errs7) {
                            if (typeof data2 === "string") {
                              if (!formats4.test(data2)) {
                                validate74.errors = [
                                  {
                                    instancePath:
                                      instancePath + "/meta/requestId",
                                    schemaPath:
                                      "#/components/schemas/Meta/properties/requestId/format",
                                    keyword: "format",
                                    params: { format: "uuid" },
                                    message:
                                      'must match format "' + "uuid" + '"',
                                  },
                                ];
                                return false;
                              }
                            } else {
                              validate74.errors = [
                                {
                                  instancePath:
                                    instancePath + "/meta/requestId",
                                  schemaPath:
                                    "#/components/schemas/Meta/properties/requestId/type",
                                  keyword: "type",
                                  params: { type: "string" },
                                  message: "must be string",
                                },
                              ];
                              return false;
                            }
                          }
                        }
                        var valid2 = _errs7 === errors;
                      } else {
                        var valid2 = true;
                      }
                      if (valid2) {
                        if (data1.serverTime !== undefined) {
                          let data3 = data1.serverTime;
                          const _errs9 = errors;
                          if (errors === _errs9) {
                            if (errors === _errs9) {
                              if (typeof data3 === "string") {
                                if (!formats6.validate(data3)) {
                                  validate74.errors = [
                                    {
                                      instancePath:
                                        instancePath + "/meta/serverTime",
                                      schemaPath:
                                        "#/components/schemas/Meta/properties/serverTime/format",
                                      keyword: "format",
                                      params: { format: "date-time" },
                                      message:
                                        'must match format "' +
                                        "date-time" +
                                        '"',
                                    },
                                  ];
                                  return false;
                                }
                              } else {
                                validate74.errors = [
                                  {
                                    instancePath:
                                      instancePath + "/meta/serverTime",
                                    schemaPath:
                                      "#/components/schemas/Meta/properties/serverTime/type",
                                    keyword: "type",
                                    params: { type: "string" },
                                    message: "must be string",
                                  },
                                ];
                                return false;
                              }
                            }
                          }
                          var valid2 = _errs9 === errors;
                        } else {
                          var valid2 = true;
                        }
                        if (valid2) {
                          if (data1.apiVersion !== undefined) {
                            const _errs11 = errors;
                            if (typeof data1.apiVersion !== "string") {
                              validate74.errors = [
                                {
                                  instancePath:
                                    instancePath + "/meta/apiVersion",
                                  schemaPath:
                                    "#/components/schemas/Meta/properties/apiVersion/type",
                                  keyword: "type",
                                  params: { type: "string" },
                                  message: "must be string",
                                },
                              ];
                              return false;
                            }
                            var valid2 = _errs11 === errors;
                          } else {
                            var valid2 = true;
                          }
                        }
                      }
                    }
                  }
                } else {
                  validate74.errors = [
                    {
                      instancePath: instancePath + "/meta",
                      schemaPath: "#/components/schemas/Meta/type",
                      keyword: "type",
                      params: { type: "object" },
                      message: "must be object",
                    },
                  ];
                  return false;
                }
              }
              var valid0 = _errs3 === errors;
            } else {
              var valid0 = true;
            }
          }
        }
      }
    } else {
      validate74.errors = [
        {
          instancePath,
          schemaPath: "#/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        },
      ];
      return false;
    }
  }
  validate74.errors = vErrors;
  return errors === 0;
}
validate74.evaluated = {
  props: true,
  dynamicProps: false,
  dynamicItems: false,
};
exports.VerificationDetailEnvelope = validate77;
const schema90 = {
  type: "object",
  additionalProperties: false,
  properties: {
    data: { $ref: "#/components/schemas/VerificationResultDetail" },
    meta: { $ref: "#/components/schemas/Meta" },
  },
  required: ["data", "meta"],
};
const schema91 = {
  type: "object",
  additionalProperties: false,
  description: "الوصول إلى نتيجة تاريخية لا يعني صلاحيتها للنسخة الحالية.",
  properties: {
    attemptId: { type: "string", format: "uuid" },
    attemptRevision: {
      type: "integer",
      format: "int32",
      description:
        "إصدار محاولة، يعادل bigint في PostgreSQL لكنه مقيد هنا إلى Int32 آمن لواجهات JavaScript.",
      minimum: 0,
      maximum: 2147483647,
      example: 4,
    },
    isCurrent: { type: "boolean" },
    result: { $ref: "#/components/schemas/TransitionVerdict" },
  },
  required: ["attemptId", "attemptRevision", "isCurrent", "result"],
};
function validate78(
  data,
  {
    instancePath = "",
    parentData,
    parentDataProperty,
    rootData = data,
    dynamicAnchors = {},
  } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate78.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (errors === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (
        (data.attemptId === undefined && (missing0 = "attemptId")) ||
        (data.attemptRevision === undefined &&
          (missing0 = "attemptRevision")) ||
        (data.isCurrent === undefined && (missing0 = "isCurrent")) ||
        (data.result === undefined && (missing0 = "result"))
      ) {
        validate78.errors = [
          {
            instancePath,
            schemaPath: "#/required",
            keyword: "required",
            params: { missingProperty: missing0 },
            message: "must have required property '" + missing0 + "'",
          },
        ];
        return false;
      } else {
        const _errs1 = errors;
        for (const key0 in data) {
          if (
            !(
              key0 === "attemptId" ||
              key0 === "attemptRevision" ||
              key0 === "isCurrent" ||
              key0 === "result"
            )
          ) {
            validate78.errors = [
              {
                instancePath,
                schemaPath: "#/additionalProperties",
                keyword: "additionalProperties",
                params: { additionalProperty: key0 },
                message: "must NOT have additional properties",
              },
            ];
            return false;
            break;
          }
        }
        if (_errs1 === errors) {
          if (data.attemptId !== undefined) {
            let data0 = data.attemptId;
            const _errs2 = errors;
            if (errors === _errs2) {
              if (errors === _errs2) {
                if (typeof data0 === "string") {
                  if (!formats4.test(data0)) {
                    validate78.errors = [
                      {
                        instancePath: instancePath + "/attemptId",
                        schemaPath: "#/properties/attemptId/format",
                        keyword: "format",
                        params: { format: "uuid" },
                        message: 'must match format "' + "uuid" + '"',
                      },
                    ];
                    return false;
                  }
                } else {
                  validate78.errors = [
                    {
                      instancePath: instancePath + "/attemptId",
                      schemaPath: "#/properties/attemptId/type",
                      keyword: "type",
                      params: { type: "string" },
                      message: "must be string",
                    },
                  ];
                  return false;
                }
              }
            }
            var valid0 = _errs2 === errors;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.attemptRevision !== undefined) {
              let data1 = data.attemptRevision;
              const _errs4 = errors;
              if (
                !(typeof data1 == "number" && !(data1 % 1) && !isNaN(data1))
              ) {
                validate78.errors = [
                  {
                    instancePath: instancePath + "/attemptRevision",
                    schemaPath: "#/properties/attemptRevision/type",
                    keyword: "type",
                    params: { type: "integer" },
                    message: "must be integer",
                  },
                ];
                return false;
              }
              if (errors === _errs4) {
                if (typeof data1 == "number") {
                  if (data1 > 2147483647 || isNaN(data1)) {
                    validate78.errors = [
                      {
                        instancePath: instancePath + "/attemptRevision",
                        schemaPath: "#/properties/attemptRevision/maximum",
                        keyword: "maximum",
                        params: { comparison: "<=", limit: 2147483647 },
                        message: "must be <= 2147483647",
                      },
                    ];
                    return false;
                  } else {
                    if (data1 < 0 || isNaN(data1)) {
                      validate78.errors = [
                        {
                          instancePath: instancePath + "/attemptRevision",
                          schemaPath: "#/properties/attemptRevision/minimum",
                          keyword: "minimum",
                          params: { comparison: ">=", limit: 0 },
                          message: "must be >= 0",
                        },
                      ];
                      return false;
                    } else {
                      if (!formats0.validate(data1)) {
                        validate78.errors = [
                          {
                            instancePath: instancePath + "/attemptRevision",
                            schemaPath: "#/properties/attemptRevision/format",
                            keyword: "format",
                            params: { format: "int32" },
                            message: 'must match format "' + "int32" + '"',
                          },
                        ];
                        return false;
                      }
                    }
                  }
                }
              }
              var valid0 = _errs4 === errors;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.isCurrent !== undefined) {
                const _errs6 = errors;
                if (typeof data.isCurrent !== "boolean") {
                  validate78.errors = [
                    {
                      instancePath: instancePath + "/isCurrent",
                      schemaPath: "#/properties/isCurrent/type",
                      keyword: "type",
                      params: { type: "boolean" },
                      message: "must be boolean",
                    },
                  ];
                  return false;
                }
                var valid0 = _errs6 === errors;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.result !== undefined) {
                  const _errs8 = errors;
                  if (
                    !validate30(data.result, {
                      instancePath: instancePath + "/result",
                      parentData: data,
                      parentDataProperty: "result",
                      rootData,
                      dynamicAnchors,
                    })
                  ) {
                    vErrors =
                      vErrors === null
                        ? validate30.errors
                        : vErrors.concat(validate30.errors);
                    errors = vErrors.length;
                  }
                  var valid0 = _errs8 === errors;
                } else {
                  var valid0 = true;
                }
              }
            }
          }
        }
      }
    } else {
      validate78.errors = [
        {
          instancePath,
          schemaPath: "#/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        },
      ];
      return false;
    }
  }
  validate78.errors = vErrors;
  return errors === 0;
}
validate78.evaluated = {
  props: true,
  dynamicProps: false,
  dynamicItems: false,
};
function validate77(
  data,
  {
    instancePath = "",
    parentData,
    parentDataProperty,
    rootData = data,
    dynamicAnchors = {},
  } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate77.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (errors === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (
        (data.data === undefined && (missing0 = "data")) ||
        (data.meta === undefined && (missing0 = "meta"))
      ) {
        validate77.errors = [
          {
            instancePath,
            schemaPath: "#/required",
            keyword: "required",
            params: { missingProperty: missing0 },
            message: "must have required property '" + missing0 + "'",
          },
        ];
        return false;
      } else {
        const _errs1 = errors;
        for (const key0 in data) {
          if (!(key0 === "data" || key0 === "meta")) {
            validate77.errors = [
              {
                instancePath,
                schemaPath: "#/additionalProperties",
                keyword: "additionalProperties",
                params: { additionalProperty: key0 },
                message: "must NOT have additional properties",
              },
            ];
            return false;
            break;
          }
        }
        if (_errs1 === errors) {
          if (data.data !== undefined) {
            const _errs2 = errors;
            if (
              !validate78(data.data, {
                instancePath: instancePath + "/data",
                parentData: data,
                parentDataProperty: "data",
                rootData,
                dynamicAnchors,
              })
            ) {
              vErrors =
                vErrors === null
                  ? validate78.errors
                  : vErrors.concat(validate78.errors);
              errors = vErrors.length;
            }
            var valid0 = _errs2 === errors;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.meta !== undefined) {
              let data1 = data.meta;
              const _errs3 = errors;
              const _errs4 = errors;
              if (errors === _errs4) {
                if (
                  data1 &&
                  typeof data1 == "object" &&
                  !Array.isArray(data1)
                ) {
                  let missing1;
                  if (
                    (data1.requestId === undefined &&
                      (missing1 = "requestId")) ||
                    (data1.serverTime === undefined &&
                      (missing1 = "serverTime")) ||
                    (data1.apiVersion === undefined &&
                      (missing1 = "apiVersion"))
                  ) {
                    validate77.errors = [
                      {
                        instancePath: instancePath + "/meta",
                        schemaPath: "#/components/schemas/Meta/required",
                        keyword: "required",
                        params: { missingProperty: missing1 },
                        message:
                          "must have required property '" + missing1 + "'",
                      },
                    ];
                    return false;
                  } else {
                    const _errs6 = errors;
                    for (const key1 in data1) {
                      if (
                        !(
                          key1 === "requestId" ||
                          key1 === "serverTime" ||
                          key1 === "apiVersion"
                        )
                      ) {
                        validate77.errors = [
                          {
                            instancePath: instancePath + "/meta",
                            schemaPath:
                              "#/components/schemas/Meta/additionalProperties",
                            keyword: "additionalProperties",
                            params: { additionalProperty: key1 },
                            message: "must NOT have additional properties",
                          },
                        ];
                        return false;
                        break;
                      }
                    }
                    if (_errs6 === errors) {
                      if (data1.requestId !== undefined) {
                        let data2 = data1.requestId;
                        const _errs7 = errors;
                        if (errors === _errs7) {
                          if (errors === _errs7) {
                            if (typeof data2 === "string") {
                              if (!formats4.test(data2)) {
                                validate77.errors = [
                                  {
                                    instancePath:
                                      instancePath + "/meta/requestId",
                                    schemaPath:
                                      "#/components/schemas/Meta/properties/requestId/format",
                                    keyword: "format",
                                    params: { format: "uuid" },
                                    message:
                                      'must match format "' + "uuid" + '"',
                                  },
                                ];
                                return false;
                              }
                            } else {
                              validate77.errors = [
                                {
                                  instancePath:
                                    instancePath + "/meta/requestId",
                                  schemaPath:
                                    "#/components/schemas/Meta/properties/requestId/type",
                                  keyword: "type",
                                  params: { type: "string" },
                                  message: "must be string",
                                },
                              ];
                              return false;
                            }
                          }
                        }
                        var valid2 = _errs7 === errors;
                      } else {
                        var valid2 = true;
                      }
                      if (valid2) {
                        if (data1.serverTime !== undefined) {
                          let data3 = data1.serverTime;
                          const _errs9 = errors;
                          if (errors === _errs9) {
                            if (errors === _errs9) {
                              if (typeof data3 === "string") {
                                if (!formats6.validate(data3)) {
                                  validate77.errors = [
                                    {
                                      instancePath:
                                        instancePath + "/meta/serverTime",
                                      schemaPath:
                                        "#/components/schemas/Meta/properties/serverTime/format",
                                      keyword: "format",
                                      params: { format: "date-time" },
                                      message:
                                        'must match format "' +
                                        "date-time" +
                                        '"',
                                    },
                                  ];
                                  return false;
                                }
                              } else {
                                validate77.errors = [
                                  {
                                    instancePath:
                                      instancePath + "/meta/serverTime",
                                    schemaPath:
                                      "#/components/schemas/Meta/properties/serverTime/type",
                                    keyword: "type",
                                    params: { type: "string" },
                                    message: "must be string",
                                  },
                                ];
                                return false;
                              }
                            }
                          }
                          var valid2 = _errs9 === errors;
                        } else {
                          var valid2 = true;
                        }
                        if (valid2) {
                          if (data1.apiVersion !== undefined) {
                            const _errs11 = errors;
                            if (typeof data1.apiVersion !== "string") {
                              validate77.errors = [
                                {
                                  instancePath:
                                    instancePath + "/meta/apiVersion",
                                  schemaPath:
                                    "#/components/schemas/Meta/properties/apiVersion/type",
                                  keyword: "type",
                                  params: { type: "string" },
                                  message: "must be string",
                                },
                              ];
                              return false;
                            }
                            var valid2 = _errs11 === errors;
                          } else {
                            var valid2 = true;
                          }
                        }
                      }
                    }
                  }
                } else {
                  validate77.errors = [
                    {
                      instancePath: instancePath + "/meta",
                      schemaPath: "#/components/schemas/Meta/type",
                      keyword: "type",
                      params: { type: "object" },
                      message: "must be object",
                    },
                  ];
                  return false;
                }
              }
              var valid0 = _errs3 === errors;
            } else {
              var valid0 = true;
            }
          }
        }
      }
    } else {
      validate77.errors = [
        {
          instancePath,
          schemaPath: "#/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        },
      ];
      return false;
    }
  }
  validate77.errors = vErrors;
  return errors === 0;
}
validate77.evaluated = {
  props: true,
  dynamicProps: false,
  dynamicItems: false,
};
exports.VerificationEnvelope = validate81;
const schema93 = {
  type: "object",
  additionalProperties: false,
  properties: {
    data: { $ref: "#/components/schemas/VerificationReport" },
    meta: { $ref: "#/components/schemas/Meta" },
  },
  required: ["data", "meta"],
};
function validate81(
  data,
  {
    instancePath = "",
    parentData,
    parentDataProperty,
    rootData = data,
    dynamicAnchors = {},
  } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate81.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (errors === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (
        (data.data === undefined && (missing0 = "data")) ||
        (data.meta === undefined && (missing0 = "meta"))
      ) {
        validate81.errors = [
          {
            instancePath,
            schemaPath: "#/required",
            keyword: "required",
            params: { missingProperty: missing0 },
            message: "must have required property '" + missing0 + "'",
          },
        ];
        return false;
      } else {
        const _errs1 = errors;
        for (const key0 in data) {
          if (!(key0 === "data" || key0 === "meta")) {
            validate81.errors = [
              {
                instancePath,
                schemaPath: "#/additionalProperties",
                keyword: "additionalProperties",
                params: { additionalProperty: key0 },
                message: "must NOT have additional properties",
              },
            ];
            return false;
            break;
          }
        }
        if (_errs1 === errors) {
          if (data.data !== undefined) {
            const _errs2 = errors;
            if (
              !validate29(data.data, {
                instancePath: instancePath + "/data",
                parentData: data,
                parentDataProperty: "data",
                rootData,
                dynamicAnchors,
              })
            ) {
              vErrors =
                vErrors === null
                  ? validate29.errors
                  : vErrors.concat(validate29.errors);
              errors = vErrors.length;
            }
            var valid0 = _errs2 === errors;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.meta !== undefined) {
              let data1 = data.meta;
              const _errs3 = errors;
              const _errs4 = errors;
              if (errors === _errs4) {
                if (
                  data1 &&
                  typeof data1 == "object" &&
                  !Array.isArray(data1)
                ) {
                  let missing1;
                  if (
                    (data1.requestId === undefined &&
                      (missing1 = "requestId")) ||
                    (data1.serverTime === undefined &&
                      (missing1 = "serverTime")) ||
                    (data1.apiVersion === undefined &&
                      (missing1 = "apiVersion"))
                  ) {
                    validate81.errors = [
                      {
                        instancePath: instancePath + "/meta",
                        schemaPath: "#/components/schemas/Meta/required",
                        keyword: "required",
                        params: { missingProperty: missing1 },
                        message:
                          "must have required property '" + missing1 + "'",
                      },
                    ];
                    return false;
                  } else {
                    const _errs6 = errors;
                    for (const key1 in data1) {
                      if (
                        !(
                          key1 === "requestId" ||
                          key1 === "serverTime" ||
                          key1 === "apiVersion"
                        )
                      ) {
                        validate81.errors = [
                          {
                            instancePath: instancePath + "/meta",
                            schemaPath:
                              "#/components/schemas/Meta/additionalProperties",
                            keyword: "additionalProperties",
                            params: { additionalProperty: key1 },
                            message: "must NOT have additional properties",
                          },
                        ];
                        return false;
                        break;
                      }
                    }
                    if (_errs6 === errors) {
                      if (data1.requestId !== undefined) {
                        let data2 = data1.requestId;
                        const _errs7 = errors;
                        if (errors === _errs7) {
                          if (errors === _errs7) {
                            if (typeof data2 === "string") {
                              if (!formats4.test(data2)) {
                                validate81.errors = [
                                  {
                                    instancePath:
                                      instancePath + "/meta/requestId",
                                    schemaPath:
                                      "#/components/schemas/Meta/properties/requestId/format",
                                    keyword: "format",
                                    params: { format: "uuid" },
                                    message:
                                      'must match format "' + "uuid" + '"',
                                  },
                                ];
                                return false;
                              }
                            } else {
                              validate81.errors = [
                                {
                                  instancePath:
                                    instancePath + "/meta/requestId",
                                  schemaPath:
                                    "#/components/schemas/Meta/properties/requestId/type",
                                  keyword: "type",
                                  params: { type: "string" },
                                  message: "must be string",
                                },
                              ];
                              return false;
                            }
                          }
                        }
                        var valid2 = _errs7 === errors;
                      } else {
                        var valid2 = true;
                      }
                      if (valid2) {
                        if (data1.serverTime !== undefined) {
                          let data3 = data1.serverTime;
                          const _errs9 = errors;
                          if (errors === _errs9) {
                            if (errors === _errs9) {
                              if (typeof data3 === "string") {
                                if (!formats6.validate(data3)) {
                                  validate81.errors = [
                                    {
                                      instancePath:
                                        instancePath + "/meta/serverTime",
                                      schemaPath:
                                        "#/components/schemas/Meta/properties/serverTime/format",
                                      keyword: "format",
                                      params: { format: "date-time" },
                                      message:
                                        'must match format "' +
                                        "date-time" +
                                        '"',
                                    },
                                  ];
                                  return false;
                                }
                              } else {
                                validate81.errors = [
                                  {
                                    instancePath:
                                      instancePath + "/meta/serverTime",
                                    schemaPath:
                                      "#/components/schemas/Meta/properties/serverTime/type",
                                    keyword: "type",
                                    params: { type: "string" },
                                    message: "must be string",
                                  },
                                ];
                                return false;
                              }
                            }
                          }
                          var valid2 = _errs9 === errors;
                        } else {
                          var valid2 = true;
                        }
                        if (valid2) {
                          if (data1.apiVersion !== undefined) {
                            const _errs11 = errors;
                            if (typeof data1.apiVersion !== "string") {
                              validate81.errors = [
                                {
                                  instancePath:
                                    instancePath + "/meta/apiVersion",
                                  schemaPath:
                                    "#/components/schemas/Meta/properties/apiVersion/type",
                                  keyword: "type",
                                  params: { type: "string" },
                                  message: "must be string",
                                },
                              ];
                              return false;
                            }
                            var valid2 = _errs11 === errors;
                          } else {
                            var valid2 = true;
                          }
                        }
                      }
                    }
                  }
                } else {
                  validate81.errors = [
                    {
                      instancePath: instancePath + "/meta",
                      schemaPath: "#/components/schemas/Meta/type",
                      keyword: "type",
                      params: { type: "object" },
                      message: "must be object",
                    },
                  ];
                  return false;
                }
              }
              var valid0 = _errs3 === errors;
            } else {
              var valid0 = true;
            }
          }
        }
      }
    } else {
      validate81.errors = [
        {
          instancePath,
          schemaPath: "#/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        },
      ];
      return false;
    }
  }
  validate81.errors = vErrors;
  return errors === 0;
}
validate81.evaluated = {
  props: true,
  dynamicProps: false,
  dynamicItems: false,
};
exports.StepMutationEnvelope = validate83;
const schema95 = {
  type: "object",
  additionalProperties: false,
  properties: {
    data: { $ref: "#/components/schemas/StepMutationResult" },
    meta: { $ref: "#/components/schemas/Meta" },
  },
  required: ["data", "meta"],
};
const schema96 = {
  type: "object",
  additionalProperties: false,
  properties: {
    attemptId: { type: "string", format: "uuid" },
    attemptRevision: {
      type: "integer",
      format: "int32",
      description:
        "إصدار محاولة، يعادل bigint في PostgreSQL لكنه مقيد هنا إلى Int32 آمن لواجهات JavaScript.",
      minimum: 0,
      maximum: 2147483647,
      example: 4,
    },
    step: { anyOf: [{ $ref: "#/components/schemas/Step" }, { type: "null" }] },
    invalidatedFromPosition: {
      type: "integer",
      format: "int32",
      description: "أول موقع يجب إعادة فحصه.",
      minimum: 1,
    },
    invalidatedVerificationCount: {
      type: "integer",
      format: "int32",
      minimum: 0,
    },
  },
  required: [
    "attemptId",
    "attemptRevision",
    "step",
    "invalidatedFromPosition",
    "invalidatedVerificationCount",
  ],
};
function validate84(
  data,
  {
    instancePath = "",
    parentData,
    parentDataProperty,
    rootData = data,
    dynamicAnchors = {},
  } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate84.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (errors === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (
        (data.attemptId === undefined && (missing0 = "attemptId")) ||
        (data.attemptRevision === undefined &&
          (missing0 = "attemptRevision")) ||
        (data.step === undefined && (missing0 = "step")) ||
        (data.invalidatedFromPosition === undefined &&
          (missing0 = "invalidatedFromPosition")) ||
        (data.invalidatedVerificationCount === undefined &&
          (missing0 = "invalidatedVerificationCount"))
      ) {
        validate84.errors = [
          {
            instancePath,
            schemaPath: "#/required",
            keyword: "required",
            params: { missingProperty: missing0 },
            message: "must have required property '" + missing0 + "'",
          },
        ];
        return false;
      } else {
        const _errs1 = errors;
        for (const key0 in data) {
          if (
            !(
              key0 === "attemptId" ||
              key0 === "attemptRevision" ||
              key0 === "step" ||
              key0 === "invalidatedFromPosition" ||
              key0 === "invalidatedVerificationCount"
            )
          ) {
            validate84.errors = [
              {
                instancePath,
                schemaPath: "#/additionalProperties",
                keyword: "additionalProperties",
                params: { additionalProperty: key0 },
                message: "must NOT have additional properties",
              },
            ];
            return false;
            break;
          }
        }
        if (_errs1 === errors) {
          if (data.attemptId !== undefined) {
            let data0 = data.attemptId;
            const _errs2 = errors;
            if (errors === _errs2) {
              if (errors === _errs2) {
                if (typeof data0 === "string") {
                  if (!formats4.test(data0)) {
                    validate84.errors = [
                      {
                        instancePath: instancePath + "/attemptId",
                        schemaPath: "#/properties/attemptId/format",
                        keyword: "format",
                        params: { format: "uuid" },
                        message: 'must match format "' + "uuid" + '"',
                      },
                    ];
                    return false;
                  }
                } else {
                  validate84.errors = [
                    {
                      instancePath: instancePath + "/attemptId",
                      schemaPath: "#/properties/attemptId/type",
                      keyword: "type",
                      params: { type: "string" },
                      message: "must be string",
                    },
                  ];
                  return false;
                }
              }
            }
            var valid0 = _errs2 === errors;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.attemptRevision !== undefined) {
              let data1 = data.attemptRevision;
              const _errs4 = errors;
              if (
                !(typeof data1 == "number" && !(data1 % 1) && !isNaN(data1))
              ) {
                validate84.errors = [
                  {
                    instancePath: instancePath + "/attemptRevision",
                    schemaPath: "#/properties/attemptRevision/type",
                    keyword: "type",
                    params: { type: "integer" },
                    message: "must be integer",
                  },
                ];
                return false;
              }
              if (errors === _errs4) {
                if (typeof data1 == "number") {
                  if (data1 > 2147483647 || isNaN(data1)) {
                    validate84.errors = [
                      {
                        instancePath: instancePath + "/attemptRevision",
                        schemaPath: "#/properties/attemptRevision/maximum",
                        keyword: "maximum",
                        params: { comparison: "<=", limit: 2147483647 },
                        message: "must be <= 2147483647",
                      },
                    ];
                    return false;
                  } else {
                    if (data1 < 0 || isNaN(data1)) {
                      validate84.errors = [
                        {
                          instancePath: instancePath + "/attemptRevision",
                          schemaPath: "#/properties/attemptRevision/minimum",
                          keyword: "minimum",
                          params: { comparison: ">=", limit: 0 },
                          message: "must be >= 0",
                        },
                      ];
                      return false;
                    } else {
                      if (!formats0.validate(data1)) {
                        validate84.errors = [
                          {
                            instancePath: instancePath + "/attemptRevision",
                            schemaPath: "#/properties/attemptRevision/format",
                            keyword: "format",
                            params: { format: "int32" },
                            message: 'must match format "' + "int32" + '"',
                          },
                        ];
                        return false;
                      }
                    }
                  }
                }
              }
              var valid0 = _errs4 === errors;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.step !== undefined) {
                let data2 = data.step;
                const _errs6 = errors;
                const _errs7 = errors;
                let valid1 = false;
                const _errs8 = errors;
                if (
                  !validate27(data2, {
                    instancePath: instancePath + "/step",
                    parentData: data,
                    parentDataProperty: "step",
                    rootData,
                    dynamicAnchors,
                  })
                ) {
                  vErrors =
                    vErrors === null
                      ? validate27.errors
                      : vErrors.concat(validate27.errors);
                  errors = vErrors.length;
                }
                var _valid0 = _errs8 === errors;
                valid1 = valid1 || _valid0;
                const _errs9 = errors;
                if (data2 !== null) {
                  const err0 = {
                    instancePath: instancePath + "/step",
                    schemaPath: "#/properties/step/anyOf/1/type",
                    keyword: "type",
                    params: { type: "null" },
                    message: "must be null",
                  };
                  if (vErrors === null) {
                    vErrors = [err0];
                  } else {
                    vErrors.push(err0);
                  }
                  errors++;
                }
                var _valid0 = _errs9 === errors;
                valid1 = valid1 || _valid0;
                if (!valid1) {
                  const err1 = {
                    instancePath: instancePath + "/step",
                    schemaPath: "#/properties/step/anyOf",
                    keyword: "anyOf",
                    params: {},
                    message: "must match a schema in anyOf",
                  };
                  if (vErrors === null) {
                    vErrors = [err1];
                  } else {
                    vErrors.push(err1);
                  }
                  errors++;
                  validate84.errors = vErrors;
                  return false;
                } else {
                  errors = _errs7;
                  if (vErrors !== null) {
                    if (_errs7) {
                      vErrors.length = _errs7;
                    } else {
                      vErrors = null;
                    }
                  }
                }
                var valid0 = _errs6 === errors;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.invalidatedFromPosition !== undefined) {
                  let data3 = data.invalidatedFromPosition;
                  const _errs11 = errors;
                  if (
                    !(typeof data3 == "number" && !(data3 % 1) && !isNaN(data3))
                  ) {
                    validate84.errors = [
                      {
                        instancePath: instancePath + "/invalidatedFromPosition",
                        schemaPath: "#/properties/invalidatedFromPosition/type",
                        keyword: "type",
                        params: { type: "integer" },
                        message: "must be integer",
                      },
                    ];
                    return false;
                  }
                  if (errors === _errs11) {
                    if (typeof data3 == "number") {
                      if (data3 < 1 || isNaN(data3)) {
                        validate84.errors = [
                          {
                            instancePath:
                              instancePath + "/invalidatedFromPosition",
                            schemaPath:
                              "#/properties/invalidatedFromPosition/minimum",
                            keyword: "minimum",
                            params: { comparison: ">=", limit: 1 },
                            message: "must be >= 1",
                          },
                        ];
                        return false;
                      } else {
                        if (!formats0.validate(data3)) {
                          validate84.errors = [
                            {
                              instancePath:
                                instancePath + "/invalidatedFromPosition",
                              schemaPath:
                                "#/properties/invalidatedFromPosition/format",
                              keyword: "format",
                              params: { format: "int32" },
                              message: 'must match format "' + "int32" + '"',
                            },
                          ];
                          return false;
                        }
                      }
                    }
                  }
                  var valid0 = _errs11 === errors;
                } else {
                  var valid0 = true;
                }
                if (valid0) {
                  if (data.invalidatedVerificationCount !== undefined) {
                    let data4 = data.invalidatedVerificationCount;
                    const _errs13 = errors;
                    if (
                      !(
                        typeof data4 == "number" &&
                        !(data4 % 1) &&
                        !isNaN(data4)
                      )
                    ) {
                      validate84.errors = [
                        {
                          instancePath:
                            instancePath + "/invalidatedVerificationCount",
                          schemaPath:
                            "#/properties/invalidatedVerificationCount/type",
                          keyword: "type",
                          params: { type: "integer" },
                          message: "must be integer",
                        },
                      ];
                      return false;
                    }
                    if (errors === _errs13) {
                      if (typeof data4 == "number") {
                        if (data4 < 0 || isNaN(data4)) {
                          validate84.errors = [
                            {
                              instancePath:
                                instancePath + "/invalidatedVerificationCount",
                              schemaPath:
                                "#/properties/invalidatedVerificationCount/minimum",
                              keyword: "minimum",
                              params: { comparison: ">=", limit: 0 },
                              message: "must be >= 0",
                            },
                          ];
                          return false;
                        } else {
                          if (!formats0.validate(data4)) {
                            validate84.errors = [
                              {
                                instancePath:
                                  instancePath +
                                  "/invalidatedVerificationCount",
                                schemaPath:
                                  "#/properties/invalidatedVerificationCount/format",
                                keyword: "format",
                                params: { format: "int32" },
                                message: 'must match format "' + "int32" + '"',
                              },
                            ];
                            return false;
                          }
                        }
                      }
                    }
                    var valid0 = _errs13 === errors;
                  } else {
                    var valid0 = true;
                  }
                }
              }
            }
          }
        }
      }
    } else {
      validate84.errors = [
        {
          instancePath,
          schemaPath: "#/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        },
      ];
      return false;
    }
  }
  validate84.errors = vErrors;
  return errors === 0;
}
validate84.evaluated = {
  props: true,
  dynamicProps: false,
  dynamicItems: false,
};
function validate83(
  data,
  {
    instancePath = "",
    parentData,
    parentDataProperty,
    rootData = data,
    dynamicAnchors = {},
  } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate83.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (errors === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (
        (data.data === undefined && (missing0 = "data")) ||
        (data.meta === undefined && (missing0 = "meta"))
      ) {
        validate83.errors = [
          {
            instancePath,
            schemaPath: "#/required",
            keyword: "required",
            params: { missingProperty: missing0 },
            message: "must have required property '" + missing0 + "'",
          },
        ];
        return false;
      } else {
        const _errs1 = errors;
        for (const key0 in data) {
          if (!(key0 === "data" || key0 === "meta")) {
            validate83.errors = [
              {
                instancePath,
                schemaPath: "#/additionalProperties",
                keyword: "additionalProperties",
                params: { additionalProperty: key0 },
                message: "must NOT have additional properties",
              },
            ];
            return false;
            break;
          }
        }
        if (_errs1 === errors) {
          if (data.data !== undefined) {
            const _errs2 = errors;
            if (
              !validate84(data.data, {
                instancePath: instancePath + "/data",
                parentData: data,
                parentDataProperty: "data",
                rootData,
                dynamicAnchors,
              })
            ) {
              vErrors =
                vErrors === null
                  ? validate84.errors
                  : vErrors.concat(validate84.errors);
              errors = vErrors.length;
            }
            var valid0 = _errs2 === errors;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.meta !== undefined) {
              let data1 = data.meta;
              const _errs3 = errors;
              const _errs4 = errors;
              if (errors === _errs4) {
                if (
                  data1 &&
                  typeof data1 == "object" &&
                  !Array.isArray(data1)
                ) {
                  let missing1;
                  if (
                    (data1.requestId === undefined &&
                      (missing1 = "requestId")) ||
                    (data1.serverTime === undefined &&
                      (missing1 = "serverTime")) ||
                    (data1.apiVersion === undefined &&
                      (missing1 = "apiVersion"))
                  ) {
                    validate83.errors = [
                      {
                        instancePath: instancePath + "/meta",
                        schemaPath: "#/components/schemas/Meta/required",
                        keyword: "required",
                        params: { missingProperty: missing1 },
                        message:
                          "must have required property '" + missing1 + "'",
                      },
                    ];
                    return false;
                  } else {
                    const _errs6 = errors;
                    for (const key1 in data1) {
                      if (
                        !(
                          key1 === "requestId" ||
                          key1 === "serverTime" ||
                          key1 === "apiVersion"
                        )
                      ) {
                        validate83.errors = [
                          {
                            instancePath: instancePath + "/meta",
                            schemaPath:
                              "#/components/schemas/Meta/additionalProperties",
                            keyword: "additionalProperties",
                            params: { additionalProperty: key1 },
                            message: "must NOT have additional properties",
                          },
                        ];
                        return false;
                        break;
                      }
                    }
                    if (_errs6 === errors) {
                      if (data1.requestId !== undefined) {
                        let data2 = data1.requestId;
                        const _errs7 = errors;
                        if (errors === _errs7) {
                          if (errors === _errs7) {
                            if (typeof data2 === "string") {
                              if (!formats4.test(data2)) {
                                validate83.errors = [
                                  {
                                    instancePath:
                                      instancePath + "/meta/requestId",
                                    schemaPath:
                                      "#/components/schemas/Meta/properties/requestId/format",
                                    keyword: "format",
                                    params: { format: "uuid" },
                                    message:
                                      'must match format "' + "uuid" + '"',
                                  },
                                ];
                                return false;
                              }
                            } else {
                              validate83.errors = [
                                {
                                  instancePath:
                                    instancePath + "/meta/requestId",
                                  schemaPath:
                                    "#/components/schemas/Meta/properties/requestId/type",
                                  keyword: "type",
                                  params: { type: "string" },
                                  message: "must be string",
                                },
                              ];
                              return false;
                            }
                          }
                        }
                        var valid2 = _errs7 === errors;
                      } else {
                        var valid2 = true;
                      }
                      if (valid2) {
                        if (data1.serverTime !== undefined) {
                          let data3 = data1.serverTime;
                          const _errs9 = errors;
                          if (errors === _errs9) {
                            if (errors === _errs9) {
                              if (typeof data3 === "string") {
                                if (!formats6.validate(data3)) {
                                  validate83.errors = [
                                    {
                                      instancePath:
                                        instancePath + "/meta/serverTime",
                                      schemaPath:
                                        "#/components/schemas/Meta/properties/serverTime/format",
                                      keyword: "format",
                                      params: { format: "date-time" },
                                      message:
                                        'must match format "' +
                                        "date-time" +
                                        '"',
                                    },
                                  ];
                                  return false;
                                }
                              } else {
                                validate83.errors = [
                                  {
                                    instancePath:
                                      instancePath + "/meta/serverTime",
                                    schemaPath:
                                      "#/components/schemas/Meta/properties/serverTime/type",
                                    keyword: "type",
                                    params: { type: "string" },
                                    message: "must be string",
                                  },
                                ];
                                return false;
                              }
                            }
                          }
                          var valid2 = _errs9 === errors;
                        } else {
                          var valid2 = true;
                        }
                        if (valid2) {
                          if (data1.apiVersion !== undefined) {
                            const _errs11 = errors;
                            if (typeof data1.apiVersion !== "string") {
                              validate83.errors = [
                                {
                                  instancePath:
                                    instancePath + "/meta/apiVersion",
                                  schemaPath:
                                    "#/components/schemas/Meta/properties/apiVersion/type",
                                  keyword: "type",
                                  params: { type: "string" },
                                  message: "must be string",
                                },
                              ];
                              return false;
                            }
                            var valid2 = _errs11 === errors;
                          } else {
                            var valid2 = true;
                          }
                        }
                      }
                    }
                  }
                } else {
                  validate83.errors = [
                    {
                      instancePath: instancePath + "/meta",
                      schemaPath: "#/components/schemas/Meta/type",
                      keyword: "type",
                      params: { type: "object" },
                      message: "must be object",
                    },
                  ];
                  return false;
                }
              }
              var valid0 = _errs3 === errors;
            } else {
              var valid0 = true;
            }
          }
        }
      }
    } else {
      validate83.errors = [
        {
          instancePath,
          schemaPath: "#/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        },
      ];
      return false;
    }
  }
  validate83.errors = vErrors;
  return errors === 0;
}
validate83.evaluated = {
  props: true,
  dynamicProps: false,
  dynamicItems: false,
};
exports.AttemptEnvelope = validate87;
const schema98 = {
  type: "object",
  additionalProperties: false,
  properties: {
    data: { $ref: "#/components/schemas/Attempt" },
    meta: { $ref: "#/components/schemas/Meta" },
  },
  required: ["data", "meta"],
};
function validate87(
  data,
  {
    instancePath = "",
    parentData,
    parentDataProperty,
    rootData = data,
    dynamicAnchors = {},
  } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate87.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (errors === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (
        (data.data === undefined && (missing0 = "data")) ||
        (data.meta === undefined && (missing0 = "meta"))
      ) {
        validate87.errors = [
          {
            instancePath,
            schemaPath: "#/required",
            keyword: "required",
            params: { missingProperty: missing0 },
            message: "must have required property '" + missing0 + "'",
          },
        ];
        return false;
      } else {
        const _errs1 = errors;
        for (const key0 in data) {
          if (!(key0 === "data" || key0 === "meta")) {
            validate87.errors = [
              {
                instancePath,
                schemaPath: "#/additionalProperties",
                keyword: "additionalProperties",
                params: { additionalProperty: key0 },
                message: "must NOT have additional properties",
              },
            ];
            return false;
            break;
          }
        }
        if (_errs1 === errors) {
          if (data.data !== undefined) {
            const _errs2 = errors;
            if (
              !validate26(data.data, {
                instancePath: instancePath + "/data",
                parentData: data,
                parentDataProperty: "data",
                rootData,
                dynamicAnchors,
              })
            ) {
              vErrors =
                vErrors === null
                  ? validate26.errors
                  : vErrors.concat(validate26.errors);
              errors = vErrors.length;
            }
            var valid0 = _errs2 === errors;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.meta !== undefined) {
              let data1 = data.meta;
              const _errs3 = errors;
              const _errs4 = errors;
              if (errors === _errs4) {
                if (
                  data1 &&
                  typeof data1 == "object" &&
                  !Array.isArray(data1)
                ) {
                  let missing1;
                  if (
                    (data1.requestId === undefined &&
                      (missing1 = "requestId")) ||
                    (data1.serverTime === undefined &&
                      (missing1 = "serverTime")) ||
                    (data1.apiVersion === undefined &&
                      (missing1 = "apiVersion"))
                  ) {
                    validate87.errors = [
                      {
                        instancePath: instancePath + "/meta",
                        schemaPath: "#/components/schemas/Meta/required",
                        keyword: "required",
                        params: { missingProperty: missing1 },
                        message:
                          "must have required property '" + missing1 + "'",
                      },
                    ];
                    return false;
                  } else {
                    const _errs6 = errors;
                    for (const key1 in data1) {
                      if (
                        !(
                          key1 === "requestId" ||
                          key1 === "serverTime" ||
                          key1 === "apiVersion"
                        )
                      ) {
                        validate87.errors = [
                          {
                            instancePath: instancePath + "/meta",
                            schemaPath:
                              "#/components/schemas/Meta/additionalProperties",
                            keyword: "additionalProperties",
                            params: { additionalProperty: key1 },
                            message: "must NOT have additional properties",
                          },
                        ];
                        return false;
                        break;
                      }
                    }
                    if (_errs6 === errors) {
                      if (data1.requestId !== undefined) {
                        let data2 = data1.requestId;
                        const _errs7 = errors;
                        if (errors === _errs7) {
                          if (errors === _errs7) {
                            if (typeof data2 === "string") {
                              if (!formats4.test(data2)) {
                                validate87.errors = [
                                  {
                                    instancePath:
                                      instancePath + "/meta/requestId",
                                    schemaPath:
                                      "#/components/schemas/Meta/properties/requestId/format",
                                    keyword: "format",
                                    params: { format: "uuid" },
                                    message:
                                      'must match format "' + "uuid" + '"',
                                  },
                                ];
                                return false;
                              }
                            } else {
                              validate87.errors = [
                                {
                                  instancePath:
                                    instancePath + "/meta/requestId",
                                  schemaPath:
                                    "#/components/schemas/Meta/properties/requestId/type",
                                  keyword: "type",
                                  params: { type: "string" },
                                  message: "must be string",
                                },
                              ];
                              return false;
                            }
                          }
                        }
                        var valid2 = _errs7 === errors;
                      } else {
                        var valid2 = true;
                      }
                      if (valid2) {
                        if (data1.serverTime !== undefined) {
                          let data3 = data1.serverTime;
                          const _errs9 = errors;
                          if (errors === _errs9) {
                            if (errors === _errs9) {
                              if (typeof data3 === "string") {
                                if (!formats6.validate(data3)) {
                                  validate87.errors = [
                                    {
                                      instancePath:
                                        instancePath + "/meta/serverTime",
                                      schemaPath:
                                        "#/components/schemas/Meta/properties/serverTime/format",
                                      keyword: "format",
                                      params: { format: "date-time" },
                                      message:
                                        'must match format "' +
                                        "date-time" +
                                        '"',
                                    },
                                  ];
                                  return false;
                                }
                              } else {
                                validate87.errors = [
                                  {
                                    instancePath:
                                      instancePath + "/meta/serverTime",
                                    schemaPath:
                                      "#/components/schemas/Meta/properties/serverTime/type",
                                    keyword: "type",
                                    params: { type: "string" },
                                    message: "must be string",
                                  },
                                ];
                                return false;
                              }
                            }
                          }
                          var valid2 = _errs9 === errors;
                        } else {
                          var valid2 = true;
                        }
                        if (valid2) {
                          if (data1.apiVersion !== undefined) {
                            const _errs11 = errors;
                            if (typeof data1.apiVersion !== "string") {
                              validate87.errors = [
                                {
                                  instancePath:
                                    instancePath + "/meta/apiVersion",
                                  schemaPath:
                                    "#/components/schemas/Meta/properties/apiVersion/type",
                                  keyword: "type",
                                  params: { type: "string" },
                                  message: "must be string",
                                },
                              ];
                              return false;
                            }
                            var valid2 = _errs11 === errors;
                          } else {
                            var valid2 = true;
                          }
                        }
                      }
                    }
                  }
                } else {
                  validate87.errors = [
                    {
                      instancePath: instancePath + "/meta",
                      schemaPath: "#/components/schemas/Meta/type",
                      keyword: "type",
                      params: { type: "object" },
                      message: "must be object",
                    },
                  ];
                  return false;
                }
              }
              var valid0 = _errs3 === errors;
            } else {
              var valid0 = true;
            }
          }
        }
      }
    } else {
      validate87.errors = [
        {
          instancePath,
          schemaPath: "#/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        },
      ];
      return false;
    }
  }
  validate87.errors = vErrors;
  return errors === 0;
}
validate87.evaluated = {
  props: true,
  dynamicProps: false,
  dynamicItems: false,
};
exports.ProblemEnvelope = validate89;
const schema100 = {
  type: "object",
  additionalProperties: false,
  properties: {
    data: { $ref: "#/components/schemas/ProblemDetail" },
    meta: { $ref: "#/components/schemas/Meta" },
  },
  required: ["data", "meta"],
};
function validate89(
  data,
  {
    instancePath = "",
    parentData,
    parentDataProperty,
    rootData = data,
    dynamicAnchors = {},
  } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate89.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (errors === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (
        (data.data === undefined && (missing0 = "data")) ||
        (data.meta === undefined && (missing0 = "meta"))
      ) {
        validate89.errors = [
          {
            instancePath,
            schemaPath: "#/required",
            keyword: "required",
            params: { missingProperty: missing0 },
            message: "must have required property '" + missing0 + "'",
          },
        ];
        return false;
      } else {
        const _errs1 = errors;
        for (const key0 in data) {
          if (!(key0 === "data" || key0 === "meta")) {
            validate89.errors = [
              {
                instancePath,
                schemaPath: "#/additionalProperties",
                keyword: "additionalProperties",
                params: { additionalProperty: key0 },
                message: "must NOT have additional properties",
              },
            ];
            return false;
            break;
          }
        }
        if (_errs1 === errors) {
          if (data.data !== undefined) {
            const _errs2 = errors;
            if (
              !validate46(data.data, {
                instancePath: instancePath + "/data",
                parentData: data,
                parentDataProperty: "data",
                rootData,
                dynamicAnchors,
              })
            ) {
              vErrors =
                vErrors === null
                  ? validate46.errors
                  : vErrors.concat(validate46.errors);
              errors = vErrors.length;
            }
            var valid0 = _errs2 === errors;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.meta !== undefined) {
              let data1 = data.meta;
              const _errs3 = errors;
              const _errs4 = errors;
              if (errors === _errs4) {
                if (
                  data1 &&
                  typeof data1 == "object" &&
                  !Array.isArray(data1)
                ) {
                  let missing1;
                  if (
                    (data1.requestId === undefined &&
                      (missing1 = "requestId")) ||
                    (data1.serverTime === undefined &&
                      (missing1 = "serverTime")) ||
                    (data1.apiVersion === undefined &&
                      (missing1 = "apiVersion"))
                  ) {
                    validate89.errors = [
                      {
                        instancePath: instancePath + "/meta",
                        schemaPath: "#/components/schemas/Meta/required",
                        keyword: "required",
                        params: { missingProperty: missing1 },
                        message:
                          "must have required property '" + missing1 + "'",
                      },
                    ];
                    return false;
                  } else {
                    const _errs6 = errors;
                    for (const key1 in data1) {
                      if (
                        !(
                          key1 === "requestId" ||
                          key1 === "serverTime" ||
                          key1 === "apiVersion"
                        )
                      ) {
                        validate89.errors = [
                          {
                            instancePath: instancePath + "/meta",
                            schemaPath:
                              "#/components/schemas/Meta/additionalProperties",
                            keyword: "additionalProperties",
                            params: { additionalProperty: key1 },
                            message: "must NOT have additional properties",
                          },
                        ];
                        return false;
                        break;
                      }
                    }
                    if (_errs6 === errors) {
                      if (data1.requestId !== undefined) {
                        let data2 = data1.requestId;
                        const _errs7 = errors;
                        if (errors === _errs7) {
                          if (errors === _errs7) {
                            if (typeof data2 === "string") {
                              if (!formats4.test(data2)) {
                                validate89.errors = [
                                  {
                                    instancePath:
                                      instancePath + "/meta/requestId",
                                    schemaPath:
                                      "#/components/schemas/Meta/properties/requestId/format",
                                    keyword: "format",
                                    params: { format: "uuid" },
                                    message:
                                      'must match format "' + "uuid" + '"',
                                  },
                                ];
                                return false;
                              }
                            } else {
                              validate89.errors = [
                                {
                                  instancePath:
                                    instancePath + "/meta/requestId",
                                  schemaPath:
                                    "#/components/schemas/Meta/properties/requestId/type",
                                  keyword: "type",
                                  params: { type: "string" },
                                  message: "must be string",
                                },
                              ];
                              return false;
                            }
                          }
                        }
                        var valid2 = _errs7 === errors;
                      } else {
                        var valid2 = true;
                      }
                      if (valid2) {
                        if (data1.serverTime !== undefined) {
                          let data3 = data1.serverTime;
                          const _errs9 = errors;
                          if (errors === _errs9) {
                            if (errors === _errs9) {
                              if (typeof data3 === "string") {
                                if (!formats6.validate(data3)) {
                                  validate89.errors = [
                                    {
                                      instancePath:
                                        instancePath + "/meta/serverTime",
                                      schemaPath:
                                        "#/components/schemas/Meta/properties/serverTime/format",
                                      keyword: "format",
                                      params: { format: "date-time" },
                                      message:
                                        'must match format "' +
                                        "date-time" +
                                        '"',
                                    },
                                  ];
                                  return false;
                                }
                              } else {
                                validate89.errors = [
                                  {
                                    instancePath:
                                      instancePath + "/meta/serverTime",
                                    schemaPath:
                                      "#/components/schemas/Meta/properties/serverTime/type",
                                    keyword: "type",
                                    params: { type: "string" },
                                    message: "must be string",
                                  },
                                ];
                                return false;
                              }
                            }
                          }
                          var valid2 = _errs9 === errors;
                        } else {
                          var valid2 = true;
                        }
                        if (valid2) {
                          if (data1.apiVersion !== undefined) {
                            const _errs11 = errors;
                            if (typeof data1.apiVersion !== "string") {
                              validate89.errors = [
                                {
                                  instancePath:
                                    instancePath + "/meta/apiVersion",
                                  schemaPath:
                                    "#/components/schemas/Meta/properties/apiVersion/type",
                                  keyword: "type",
                                  params: { type: "string" },
                                  message: "must be string",
                                },
                              ];
                              return false;
                            }
                            var valid2 = _errs11 === errors;
                          } else {
                            var valid2 = true;
                          }
                        }
                      }
                    }
                  }
                } else {
                  validate89.errors = [
                    {
                      instancePath: instancePath + "/meta",
                      schemaPath: "#/components/schemas/Meta/type",
                      keyword: "type",
                      params: { type: "object" },
                      message: "must be object",
                    },
                  ];
                  return false;
                }
              }
              var valid0 = _errs3 === errors;
            } else {
              var valid0 = true;
            }
          }
        }
      }
    } else {
      validate89.errors = [
        {
          instancePath,
          schemaPath: "#/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        },
      ];
      return false;
    }
  }
  validate89.errors = vErrors;
  return errors === 0;
}
validate89.evaluated = {
  props: true,
  dynamicProps: false,
  dynamicItems: false,
};
exports.ProblemListEnvelope = validate91;
const schema102 = {
  type: "object",
  additionalProperties: false,
  properties: {
    data: { $ref: "#/components/schemas/ListProblems" },
    meta: { $ref: "#/components/schemas/Meta" },
  },
  required: ["data", "meta"],
};
const schema103 = {
  type: "object",
  additionalProperties: false,
  properties: {
    items: {
      type: "array",
      items: { $ref: "#/components/schemas/ProblemSummary" },
    },
    nextCursor: {
      anyOf: [
        { type: "string", description: "مؤشر معتم لا تُفسر قيمته." },
        { type: "null" },
      ],
    },
  },
  required: ["items", "nextCursor"],
};
const schema104 = {
  type: "object",
  additionalProperties: false,
  properties: {
    id: {
      type: "string",
      description: "هوية المسألة الأساسية.",
      format: "uuid",
    },
    revisionId: {
      type: "string",
      description: "النسخة المنشورة المحددة.",
      format: "uuid",
    },
    titleAr: { type: "string" },
    kind: { $ref: "#/components/schemas/ProblemKind" },
    skillId: { type: "string", format: "uuid" },
    difficultyBand: {
      type: "integer",
      format: "int32",
      minimum: 1,
      maximum: 5,
    },
    notationProfile: { type: "string" },
    contentReleaseId: { type: "string", format: "uuid" },
  },
  required: [
    "id",
    "revisionId",
    "titleAr",
    "kind",
    "skillId",
    "difficultyBand",
    "notationProfile",
    "contentReleaseId",
  ],
};
function validate93(
  data,
  {
    instancePath = "",
    parentData,
    parentDataProperty,
    rootData = data,
    dynamicAnchors = {},
  } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate93.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (errors === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (
        (data.id === undefined && (missing0 = "id")) ||
        (data.revisionId === undefined && (missing0 = "revisionId")) ||
        (data.titleAr === undefined && (missing0 = "titleAr")) ||
        (data.kind === undefined && (missing0 = "kind")) ||
        (data.skillId === undefined && (missing0 = "skillId")) ||
        (data.difficultyBand === undefined && (missing0 = "difficultyBand")) ||
        (data.notationProfile === undefined &&
          (missing0 = "notationProfile")) ||
        (data.contentReleaseId === undefined && (missing0 = "contentReleaseId"))
      ) {
        validate93.errors = [
          {
            instancePath,
            schemaPath: "#/required",
            keyword: "required",
            params: { missingProperty: missing0 },
            message: "must have required property '" + missing0 + "'",
          },
        ];
        return false;
      } else {
        const _errs1 = errors;
        for (const key0 in data) {
          if (
            !(
              key0 === "id" ||
              key0 === "revisionId" ||
              key0 === "titleAr" ||
              key0 === "kind" ||
              key0 === "skillId" ||
              key0 === "difficultyBand" ||
              key0 === "notationProfile" ||
              key0 === "contentReleaseId"
            )
          ) {
            validate93.errors = [
              {
                instancePath,
                schemaPath: "#/additionalProperties",
                keyword: "additionalProperties",
                params: { additionalProperty: key0 },
                message: "must NOT have additional properties",
              },
            ];
            return false;
            break;
          }
        }
        if (_errs1 === errors) {
          if (data.id !== undefined) {
            let data0 = data.id;
            const _errs2 = errors;
            if (errors === _errs2) {
              if (errors === _errs2) {
                if (typeof data0 === "string") {
                  if (!formats4.test(data0)) {
                    validate93.errors = [
                      {
                        instancePath: instancePath + "/id",
                        schemaPath: "#/properties/id/format",
                        keyword: "format",
                        params: { format: "uuid" },
                        message: 'must match format "' + "uuid" + '"',
                      },
                    ];
                    return false;
                  }
                } else {
                  validate93.errors = [
                    {
                      instancePath: instancePath + "/id",
                      schemaPath: "#/properties/id/type",
                      keyword: "type",
                      params: { type: "string" },
                      message: "must be string",
                    },
                  ];
                  return false;
                }
              }
            }
            var valid0 = _errs2 === errors;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.revisionId !== undefined) {
              let data1 = data.revisionId;
              const _errs4 = errors;
              if (errors === _errs4) {
                if (errors === _errs4) {
                  if (typeof data1 === "string") {
                    if (!formats4.test(data1)) {
                      validate93.errors = [
                        {
                          instancePath: instancePath + "/revisionId",
                          schemaPath: "#/properties/revisionId/format",
                          keyword: "format",
                          params: { format: "uuid" },
                          message: 'must match format "' + "uuid" + '"',
                        },
                      ];
                      return false;
                    }
                  } else {
                    validate93.errors = [
                      {
                        instancePath: instancePath + "/revisionId",
                        schemaPath: "#/properties/revisionId/type",
                        keyword: "type",
                        params: { type: "string" },
                        message: "must be string",
                      },
                    ];
                    return false;
                  }
                }
              }
              var valid0 = _errs4 === errors;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.titleAr !== undefined) {
                const _errs6 = errors;
                if (typeof data.titleAr !== "string") {
                  validate93.errors = [
                    {
                      instancePath: instancePath + "/titleAr",
                      schemaPath: "#/properties/titleAr/type",
                      keyword: "type",
                      params: { type: "string" },
                      message: "must be string",
                    },
                  ];
                  return false;
                }
                var valid0 = _errs6 === errors;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.kind !== undefined) {
                  let data3 = data.kind;
                  const _errs8 = errors;
                  if (typeof data3 !== "string") {
                    validate93.errors = [
                      {
                        instancePath: instancePath + "/kind",
                        schemaPath: "#/components/schemas/ProblemKind/type",
                        keyword: "type",
                        params: { type: "string" },
                        message: "must be string",
                      },
                    ];
                    return false;
                  }
                  if (
                    !(
                      data3 === "main" ||
                      data3 === "remediation" ||
                      data3 === "transfer" ||
                      data3 === "diagnostic"
                    )
                  ) {
                    validate93.errors = [
                      {
                        instancePath: instancePath + "/kind",
                        schemaPath: "#/components/schemas/ProblemKind/enum",
                        keyword: "enum",
                        params: { allowedValues: schema60.enum },
                        message: "must be equal to one of the allowed values",
                      },
                    ];
                    return false;
                  }
                  var valid0 = _errs8 === errors;
                } else {
                  var valid0 = true;
                }
                if (valid0) {
                  if (data.skillId !== undefined) {
                    let data4 = data.skillId;
                    const _errs11 = errors;
                    if (errors === _errs11) {
                      if (errors === _errs11) {
                        if (typeof data4 === "string") {
                          if (!formats4.test(data4)) {
                            validate93.errors = [
                              {
                                instancePath: instancePath + "/skillId",
                                schemaPath: "#/properties/skillId/format",
                                keyword: "format",
                                params: { format: "uuid" },
                                message: 'must match format "' + "uuid" + '"',
                              },
                            ];
                            return false;
                          }
                        } else {
                          validate93.errors = [
                            {
                              instancePath: instancePath + "/skillId",
                              schemaPath: "#/properties/skillId/type",
                              keyword: "type",
                              params: { type: "string" },
                              message: "must be string",
                            },
                          ];
                          return false;
                        }
                      }
                    }
                    var valid0 = _errs11 === errors;
                  } else {
                    var valid0 = true;
                  }
                  if (valid0) {
                    if (data.difficultyBand !== undefined) {
                      let data5 = data.difficultyBand;
                      const _errs13 = errors;
                      if (
                        !(
                          typeof data5 == "number" &&
                          !(data5 % 1) &&
                          !isNaN(data5)
                        )
                      ) {
                        validate93.errors = [
                          {
                            instancePath: instancePath + "/difficultyBand",
                            schemaPath: "#/properties/difficultyBand/type",
                            keyword: "type",
                            params: { type: "integer" },
                            message: "must be integer",
                          },
                        ];
                        return false;
                      }
                      if (errors === _errs13) {
                        if (typeof data5 == "number") {
                          if (data5 > 5 || isNaN(data5)) {
                            validate93.errors = [
                              {
                                instancePath: instancePath + "/difficultyBand",
                                schemaPath:
                                  "#/properties/difficultyBand/maximum",
                                keyword: "maximum",
                                params: { comparison: "<=", limit: 5 },
                                message: "must be <= 5",
                              },
                            ];
                            return false;
                          } else {
                            if (data5 < 1 || isNaN(data5)) {
                              validate93.errors = [
                                {
                                  instancePath:
                                    instancePath + "/difficultyBand",
                                  schemaPath:
                                    "#/properties/difficultyBand/minimum",
                                  keyword: "minimum",
                                  params: { comparison: ">=", limit: 1 },
                                  message: "must be >= 1",
                                },
                              ];
                              return false;
                            } else {
                              if (!formats0.validate(data5)) {
                                validate93.errors = [
                                  {
                                    instancePath:
                                      instancePath + "/difficultyBand",
                                    schemaPath:
                                      "#/properties/difficultyBand/format",
                                    keyword: "format",
                                    params: { format: "int32" },
                                    message:
                                      'must match format "' + "int32" + '"',
                                  },
                                ];
                                return false;
                              }
                            }
                          }
                        }
                      }
                      var valid0 = _errs13 === errors;
                    } else {
                      var valid0 = true;
                    }
                    if (valid0) {
                      if (data.notationProfile !== undefined) {
                        const _errs15 = errors;
                        if (typeof data.notationProfile !== "string") {
                          validate93.errors = [
                            {
                              instancePath: instancePath + "/notationProfile",
                              schemaPath: "#/properties/notationProfile/type",
                              keyword: "type",
                              params: { type: "string" },
                              message: "must be string",
                            },
                          ];
                          return false;
                        }
                        var valid0 = _errs15 === errors;
                      } else {
                        var valid0 = true;
                      }
                      if (valid0) {
                        if (data.contentReleaseId !== undefined) {
                          let data7 = data.contentReleaseId;
                          const _errs17 = errors;
                          if (errors === _errs17) {
                            if (errors === _errs17) {
                              if (typeof data7 === "string") {
                                if (!formats4.test(data7)) {
                                  validate93.errors = [
                                    {
                                      instancePath:
                                        instancePath + "/contentReleaseId",
                                      schemaPath:
                                        "#/properties/contentReleaseId/format",
                                      keyword: "format",
                                      params: { format: "uuid" },
                                      message:
                                        'must match format "' + "uuid" + '"',
                                    },
                                  ];
                                  return false;
                                }
                              } else {
                                validate93.errors = [
                                  {
                                    instancePath:
                                      instancePath + "/contentReleaseId",
                                    schemaPath:
                                      "#/properties/contentReleaseId/type",
                                    keyword: "type",
                                    params: { type: "string" },
                                    message: "must be string",
                                  },
                                ];
                                return false;
                              }
                            }
                          }
                          var valid0 = _errs17 === errors;
                        } else {
                          var valid0 = true;
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    } else {
      validate93.errors = [
        {
          instancePath,
          schemaPath: "#/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        },
      ];
      return false;
    }
  }
  validate93.errors = vErrors;
  return errors === 0;
}
validate93.evaluated = {
  props: true,
  dynamicProps: false,
  dynamicItems: false,
};
function validate92(
  data,
  {
    instancePath = "",
    parentData,
    parentDataProperty,
    rootData = data,
    dynamicAnchors = {},
  } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate92.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (errors === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (
        (data.items === undefined && (missing0 = "items")) ||
        (data.nextCursor === undefined && (missing0 = "nextCursor"))
      ) {
        validate92.errors = [
          {
            instancePath,
            schemaPath: "#/required",
            keyword: "required",
            params: { missingProperty: missing0 },
            message: "must have required property '" + missing0 + "'",
          },
        ];
        return false;
      } else {
        const _errs1 = errors;
        for (const key0 in data) {
          if (!(key0 === "items" || key0 === "nextCursor")) {
            validate92.errors = [
              {
                instancePath,
                schemaPath: "#/additionalProperties",
                keyword: "additionalProperties",
                params: { additionalProperty: key0 },
                message: "must NOT have additional properties",
              },
            ];
            return false;
            break;
          }
        }
        if (_errs1 === errors) {
          if (data.items !== undefined) {
            let data0 = data.items;
            const _errs2 = errors;
            if (errors === _errs2) {
              if (Array.isArray(data0)) {
                var valid1 = true;
                const len0 = data0.length;
                for (let i0 = 0; i0 < len0; i0++) {
                  const _errs4 = errors;
                  if (
                    !validate93(data0[i0], {
                      instancePath: instancePath + "/items/" + i0,
                      parentData: data0,
                      parentDataProperty: i0,
                      rootData,
                      dynamicAnchors,
                    })
                  ) {
                    vErrors =
                      vErrors === null
                        ? validate93.errors
                        : vErrors.concat(validate93.errors);
                    errors = vErrors.length;
                  }
                  var valid1 = _errs4 === errors;
                  if (!valid1) {
                    break;
                  }
                }
              } else {
                validate92.errors = [
                  {
                    instancePath: instancePath + "/items",
                    schemaPath: "#/properties/items/type",
                    keyword: "type",
                    params: { type: "array" },
                    message: "must be array",
                  },
                ];
                return false;
              }
            }
            var valid0 = _errs2 === errors;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.nextCursor !== undefined) {
              let data2 = data.nextCursor;
              const _errs5 = errors;
              const _errs6 = errors;
              let valid2 = false;
              const _errs7 = errors;
              if (typeof data2 !== "string") {
                const err0 = {
                  instancePath: instancePath + "/nextCursor",
                  schemaPath: "#/properties/nextCursor/anyOf/0/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                if (vErrors === null) {
                  vErrors = [err0];
                } else {
                  vErrors.push(err0);
                }
                errors++;
              }
              var _valid0 = _errs7 === errors;
              valid2 = valid2 || _valid0;
              const _errs9 = errors;
              if (data2 !== null) {
                const err1 = {
                  instancePath: instancePath + "/nextCursor",
                  schemaPath: "#/properties/nextCursor/anyOf/1/type",
                  keyword: "type",
                  params: { type: "null" },
                  message: "must be null",
                };
                if (vErrors === null) {
                  vErrors = [err1];
                } else {
                  vErrors.push(err1);
                }
                errors++;
              }
              var _valid0 = _errs9 === errors;
              valid2 = valid2 || _valid0;
              if (!valid2) {
                const err2 = {
                  instancePath: instancePath + "/nextCursor",
                  schemaPath: "#/properties/nextCursor/anyOf",
                  keyword: "anyOf",
                  params: {},
                  message: "must match a schema in anyOf",
                };
                if (vErrors === null) {
                  vErrors = [err2];
                } else {
                  vErrors.push(err2);
                }
                errors++;
                validate92.errors = vErrors;
                return false;
              } else {
                errors = _errs6;
                if (vErrors !== null) {
                  if (_errs6) {
                    vErrors.length = _errs6;
                  } else {
                    vErrors = null;
                  }
                }
              }
              var valid0 = _errs5 === errors;
            } else {
              var valid0 = true;
            }
          }
        }
      }
    } else {
      validate92.errors = [
        {
          instancePath,
          schemaPath: "#/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        },
      ];
      return false;
    }
  }
  validate92.errors = vErrors;
  return errors === 0;
}
validate92.evaluated = {
  props: true,
  dynamicProps: false,
  dynamicItems: false,
};
function validate91(
  data,
  {
    instancePath = "",
    parentData,
    parentDataProperty,
    rootData = data,
    dynamicAnchors = {},
  } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate91.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (errors === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (
        (data.data === undefined && (missing0 = "data")) ||
        (data.meta === undefined && (missing0 = "meta"))
      ) {
        validate91.errors = [
          {
            instancePath,
            schemaPath: "#/required",
            keyword: "required",
            params: { missingProperty: missing0 },
            message: "must have required property '" + missing0 + "'",
          },
        ];
        return false;
      } else {
        const _errs1 = errors;
        for (const key0 in data) {
          if (!(key0 === "data" || key0 === "meta")) {
            validate91.errors = [
              {
                instancePath,
                schemaPath: "#/additionalProperties",
                keyword: "additionalProperties",
                params: { additionalProperty: key0 },
                message: "must NOT have additional properties",
              },
            ];
            return false;
            break;
          }
        }
        if (_errs1 === errors) {
          if (data.data !== undefined) {
            const _errs2 = errors;
            if (
              !validate92(data.data, {
                instancePath: instancePath + "/data",
                parentData: data,
                parentDataProperty: "data",
                rootData,
                dynamicAnchors,
              })
            ) {
              vErrors =
                vErrors === null
                  ? validate92.errors
                  : vErrors.concat(validate92.errors);
              errors = vErrors.length;
            }
            var valid0 = _errs2 === errors;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.meta !== undefined) {
              let data1 = data.meta;
              const _errs3 = errors;
              const _errs4 = errors;
              if (errors === _errs4) {
                if (
                  data1 &&
                  typeof data1 == "object" &&
                  !Array.isArray(data1)
                ) {
                  let missing1;
                  if (
                    (data1.requestId === undefined &&
                      (missing1 = "requestId")) ||
                    (data1.serverTime === undefined &&
                      (missing1 = "serverTime")) ||
                    (data1.apiVersion === undefined &&
                      (missing1 = "apiVersion"))
                  ) {
                    validate91.errors = [
                      {
                        instancePath: instancePath + "/meta",
                        schemaPath: "#/components/schemas/Meta/required",
                        keyword: "required",
                        params: { missingProperty: missing1 },
                        message:
                          "must have required property '" + missing1 + "'",
                      },
                    ];
                    return false;
                  } else {
                    const _errs6 = errors;
                    for (const key1 in data1) {
                      if (
                        !(
                          key1 === "requestId" ||
                          key1 === "serverTime" ||
                          key1 === "apiVersion"
                        )
                      ) {
                        validate91.errors = [
                          {
                            instancePath: instancePath + "/meta",
                            schemaPath:
                              "#/components/schemas/Meta/additionalProperties",
                            keyword: "additionalProperties",
                            params: { additionalProperty: key1 },
                            message: "must NOT have additional properties",
                          },
                        ];
                        return false;
                        break;
                      }
                    }
                    if (_errs6 === errors) {
                      if (data1.requestId !== undefined) {
                        let data2 = data1.requestId;
                        const _errs7 = errors;
                        if (errors === _errs7) {
                          if (errors === _errs7) {
                            if (typeof data2 === "string") {
                              if (!formats4.test(data2)) {
                                validate91.errors = [
                                  {
                                    instancePath:
                                      instancePath + "/meta/requestId",
                                    schemaPath:
                                      "#/components/schemas/Meta/properties/requestId/format",
                                    keyword: "format",
                                    params: { format: "uuid" },
                                    message:
                                      'must match format "' + "uuid" + '"',
                                  },
                                ];
                                return false;
                              }
                            } else {
                              validate91.errors = [
                                {
                                  instancePath:
                                    instancePath + "/meta/requestId",
                                  schemaPath:
                                    "#/components/schemas/Meta/properties/requestId/type",
                                  keyword: "type",
                                  params: { type: "string" },
                                  message: "must be string",
                                },
                              ];
                              return false;
                            }
                          }
                        }
                        var valid2 = _errs7 === errors;
                      } else {
                        var valid2 = true;
                      }
                      if (valid2) {
                        if (data1.serverTime !== undefined) {
                          let data3 = data1.serverTime;
                          const _errs9 = errors;
                          if (errors === _errs9) {
                            if (errors === _errs9) {
                              if (typeof data3 === "string") {
                                if (!formats6.validate(data3)) {
                                  validate91.errors = [
                                    {
                                      instancePath:
                                        instancePath + "/meta/serverTime",
                                      schemaPath:
                                        "#/components/schemas/Meta/properties/serverTime/format",
                                      keyword: "format",
                                      params: { format: "date-time" },
                                      message:
                                        'must match format "' +
                                        "date-time" +
                                        '"',
                                    },
                                  ];
                                  return false;
                                }
                              } else {
                                validate91.errors = [
                                  {
                                    instancePath:
                                      instancePath + "/meta/serverTime",
                                    schemaPath:
                                      "#/components/schemas/Meta/properties/serverTime/type",
                                    keyword: "type",
                                    params: { type: "string" },
                                    message: "must be string",
                                  },
                                ];
                                return false;
                              }
                            }
                          }
                          var valid2 = _errs9 === errors;
                        } else {
                          var valid2 = true;
                        }
                        if (valid2) {
                          if (data1.apiVersion !== undefined) {
                            const _errs11 = errors;
                            if (typeof data1.apiVersion !== "string") {
                              validate91.errors = [
                                {
                                  instancePath:
                                    instancePath + "/meta/apiVersion",
                                  schemaPath:
                                    "#/components/schemas/Meta/properties/apiVersion/type",
                                  keyword: "type",
                                  params: { type: "string" },
                                  message: "must be string",
                                },
                              ];
                              return false;
                            }
                            var valid2 = _errs11 === errors;
                          } else {
                            var valid2 = true;
                          }
                        }
                      }
                    }
                  }
                } else {
                  validate91.errors = [
                    {
                      instancePath: instancePath + "/meta",
                      schemaPath: "#/components/schemas/Meta/type",
                      keyword: "type",
                      params: { type: "object" },
                      message: "must be object",
                    },
                  ];
                  return false;
                }
              }
              var valid0 = _errs3 === errors;
            } else {
              var valid0 = true;
            }
          }
        }
      }
    } else {
      validate91.errors = [
        {
          instancePath,
          schemaPath: "#/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        },
      ];
      return false;
    }
  }
  validate91.errors = vErrors;
  return errors === 0;
}
validate91.evaluated = {
  props: true,
  dynamicProps: false,
  dynamicItems: false,
};
exports.SkillListEnvelope = validate96;
const schema107 = {
  type: "object",
  additionalProperties: false,
  properties: {
    data: { $ref: "#/components/schemas/ListSkills" },
    meta: { $ref: "#/components/schemas/Meta" },
  },
  required: ["data", "meta"],
};
const schema108 = {
  type: "object",
  additionalProperties: false,
  properties: {
    items: { type: "array", items: { $ref: "#/components/schemas/Skill" } },
  },
  required: ["items"],
};
const schema109 = {
  type: "object",
  additionalProperties: false,
  properties: {
    id: { type: "string", format: "uuid" },
    code: {
      type: "string",
      description: "كود ثابت مثل SK-ALG-03.",
      pattern: "^SK-ALG-0[1-8]$",
    },
    titleAr: { type: "string" },
    objectiveAr: { type: "string" },
    prerequisiteSkillIds: {
      type: "array",
      items: { type: "string", format: "uuid" },
    },
    availableProblemCount: { type: "integer", format: "int32", minimum: 0 },
    availability: { type: "string", enum: ["available", "unavailable"] },
  },
  required: [
    "id",
    "code",
    "titleAr",
    "objectiveAr",
    "prerequisiteSkillIds",
    "availableProblemCount",
    "availability",
  ],
};
const pattern9 = new RegExp("^SK-ALG-0[1-8]$", "u");
function validate97(
  data,
  {
    instancePath = "",
    parentData,
    parentDataProperty,
    rootData = data,
    dynamicAnchors = {},
  } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate97.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (errors === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (data.items === undefined && (missing0 = "items")) {
        validate97.errors = [
          {
            instancePath,
            schemaPath: "#/required",
            keyword: "required",
            params: { missingProperty: missing0 },
            message: "must have required property '" + missing0 + "'",
          },
        ];
        return false;
      } else {
        const _errs1 = errors;
        for (const key0 in data) {
          if (!(key0 === "items")) {
            validate97.errors = [
              {
                instancePath,
                schemaPath: "#/additionalProperties",
                keyword: "additionalProperties",
                params: { additionalProperty: key0 },
                message: "must NOT have additional properties",
              },
            ];
            return false;
            break;
          }
        }
        if (_errs1 === errors) {
          if (data.items !== undefined) {
            let data0 = data.items;
            const _errs2 = errors;
            if (errors === _errs2) {
              if (Array.isArray(data0)) {
                var valid1 = true;
                const len0 = data0.length;
                for (let i0 = 0; i0 < len0; i0++) {
                  let data1 = data0[i0];
                  const _errs4 = errors;
                  const _errs5 = errors;
                  if (errors === _errs5) {
                    if (
                      data1 &&
                      typeof data1 == "object" &&
                      !Array.isArray(data1)
                    ) {
                      let missing1;
                      if (
                        (data1.id === undefined && (missing1 = "id")) ||
                        (data1.code === undefined && (missing1 = "code")) ||
                        (data1.titleAr === undefined &&
                          (missing1 = "titleAr")) ||
                        (data1.objectiveAr === undefined &&
                          (missing1 = "objectiveAr")) ||
                        (data1.prerequisiteSkillIds === undefined &&
                          (missing1 = "prerequisiteSkillIds")) ||
                        (data1.availableProblemCount === undefined &&
                          (missing1 = "availableProblemCount")) ||
                        (data1.availability === undefined &&
                          (missing1 = "availability"))
                      ) {
                        validate97.errors = [
                          {
                            instancePath: instancePath + "/items/" + i0,
                            schemaPath: "#/components/schemas/Skill/required",
                            keyword: "required",
                            params: { missingProperty: missing1 },
                            message:
                              "must have required property '" + missing1 + "'",
                          },
                        ];
                        return false;
                      } else {
                        const _errs7 = errors;
                        for (const key1 in data1) {
                          if (
                            !(
                              key1 === "id" ||
                              key1 === "code" ||
                              key1 === "titleAr" ||
                              key1 === "objectiveAr" ||
                              key1 === "prerequisiteSkillIds" ||
                              key1 === "availableProblemCount" ||
                              key1 === "availability"
                            )
                          ) {
                            validate97.errors = [
                              {
                                instancePath: instancePath + "/items/" + i0,
                                schemaPath:
                                  "#/components/schemas/Skill/additionalProperties",
                                keyword: "additionalProperties",
                                params: { additionalProperty: key1 },
                                message: "must NOT have additional properties",
                              },
                            ];
                            return false;
                            break;
                          }
                        }
                        if (_errs7 === errors) {
                          if (data1.id !== undefined) {
                            let data2 = data1.id;
                            const _errs8 = errors;
                            if (errors === _errs8) {
                              if (errors === _errs8) {
                                if (typeof data2 === "string") {
                                  if (!formats4.test(data2)) {
                                    validate97.errors = [
                                      {
                                        instancePath:
                                          instancePath + "/items/" + i0 + "/id",
                                        schemaPath:
                                          "#/components/schemas/Skill/properties/id/format",
                                        keyword: "format",
                                        params: { format: "uuid" },
                                        message:
                                          'must match format "' + "uuid" + '"',
                                      },
                                    ];
                                    return false;
                                  }
                                } else {
                                  validate97.errors = [
                                    {
                                      instancePath:
                                        instancePath + "/items/" + i0 + "/id",
                                      schemaPath:
                                        "#/components/schemas/Skill/properties/id/type",
                                      keyword: "type",
                                      params: { type: "string" },
                                      message: "must be string",
                                    },
                                  ];
                                  return false;
                                }
                              }
                            }
                            var valid3 = _errs8 === errors;
                          } else {
                            var valid3 = true;
                          }
                          if (valid3) {
                            if (data1.code !== undefined) {
                              let data3 = data1.code;
                              const _errs10 = errors;
                              if (errors === _errs10) {
                                if (typeof data3 === "string") {
                                  if (!pattern9.test(data3)) {
                                    validate97.errors = [
                                      {
                                        instancePath:
                                          instancePath +
                                          "/items/" +
                                          i0 +
                                          "/code",
                                        schemaPath:
                                          "#/components/schemas/Skill/properties/code/pattern",
                                        keyword: "pattern",
                                        params: { pattern: "^SK-ALG-0[1-8]$" },
                                        message:
                                          'must match pattern "' +
                                          "^SK-ALG-0[1-8]$" +
                                          '"',
                                      },
                                    ];
                                    return false;
                                  }
                                } else {
                                  validate97.errors = [
                                    {
                                      instancePath:
                                        instancePath + "/items/" + i0 + "/code",
                                      schemaPath:
                                        "#/components/schemas/Skill/properties/code/type",
                                      keyword: "type",
                                      params: { type: "string" },
                                      message: "must be string",
                                    },
                                  ];
                                  return false;
                                }
                              }
                              var valid3 = _errs10 === errors;
                            } else {
                              var valid3 = true;
                            }
                            if (valid3) {
                              if (data1.titleAr !== undefined) {
                                const _errs12 = errors;
                                if (typeof data1.titleAr !== "string") {
                                  validate97.errors = [
                                    {
                                      instancePath:
                                        instancePath +
                                        "/items/" +
                                        i0 +
                                        "/titleAr",
                                      schemaPath:
                                        "#/components/schemas/Skill/properties/titleAr/type",
                                      keyword: "type",
                                      params: { type: "string" },
                                      message: "must be string",
                                    },
                                  ];
                                  return false;
                                }
                                var valid3 = _errs12 === errors;
                              } else {
                                var valid3 = true;
                              }
                              if (valid3) {
                                if (data1.objectiveAr !== undefined) {
                                  const _errs14 = errors;
                                  if (typeof data1.objectiveAr !== "string") {
                                    validate97.errors = [
                                      {
                                        instancePath:
                                          instancePath +
                                          "/items/" +
                                          i0 +
                                          "/objectiveAr",
                                        schemaPath:
                                          "#/components/schemas/Skill/properties/objectiveAr/type",
                                        keyword: "type",
                                        params: { type: "string" },
                                        message: "must be string",
                                      },
                                    ];
                                    return false;
                                  }
                                  var valid3 = _errs14 === errors;
                                } else {
                                  var valid3 = true;
                                }
                                if (valid3) {
                                  if (
                                    data1.prerequisiteSkillIds !== undefined
                                  ) {
                                    let data6 = data1.prerequisiteSkillIds;
                                    const _errs16 = errors;
                                    if (errors === _errs16) {
                                      if (Array.isArray(data6)) {
                                        var valid4 = true;
                                        const len1 = data6.length;
                                        for (let i1 = 0; i1 < len1; i1++) {
                                          let data7 = data6[i1];
                                          const _errs18 = errors;
                                          if (errors === _errs18) {
                                            if (errors === _errs18) {
                                              if (typeof data7 === "string") {
                                                if (!formats4.test(data7)) {
                                                  validate97.errors = [
                                                    {
                                                      instancePath:
                                                        instancePath +
                                                        "/items/" +
                                                        i0 +
                                                        "/prerequisiteSkillIds/" +
                                                        i1,
                                                      schemaPath:
                                                        "#/components/schemas/Skill/properties/prerequisiteSkillIds/items/format",
                                                      keyword: "format",
                                                      params: {
                                                        format: "uuid",
                                                      },
                                                      message:
                                                        'must match format "' +
                                                        "uuid" +
                                                        '"',
                                                    },
                                                  ];
                                                  return false;
                                                }
                                              } else {
                                                validate97.errors = [
                                                  {
                                                    instancePath:
                                                      instancePath +
                                                      "/items/" +
                                                      i0 +
                                                      "/prerequisiteSkillIds/" +
                                                      i1,
                                                    schemaPath:
                                                      "#/components/schemas/Skill/properties/prerequisiteSkillIds/items/type",
                                                    keyword: "type",
                                                    params: { type: "string" },
                                                    message: "must be string",
                                                  },
                                                ];
                                                return false;
                                              }
                                            }
                                          }
                                          var valid4 = _errs18 === errors;
                                          if (!valid4) {
                                            break;
                                          }
                                        }
                                      } else {
                                        validate97.errors = [
                                          {
                                            instancePath:
                                              instancePath +
                                              "/items/" +
                                              i0 +
                                              "/prerequisiteSkillIds",
                                            schemaPath:
                                              "#/components/schemas/Skill/properties/prerequisiteSkillIds/type",
                                            keyword: "type",
                                            params: { type: "array" },
                                            message: "must be array",
                                          },
                                        ];
                                        return false;
                                      }
                                    }
                                    var valid3 = _errs16 === errors;
                                  } else {
                                    var valid3 = true;
                                  }
                                  if (valid3) {
                                    if (
                                      data1.availableProblemCount !== undefined
                                    ) {
                                      let data8 = data1.availableProblemCount;
                                      const _errs20 = errors;
                                      if (
                                        !(
                                          typeof data8 == "number" &&
                                          !(data8 % 1) &&
                                          !isNaN(data8)
                                        )
                                      ) {
                                        validate97.errors = [
                                          {
                                            instancePath:
                                              instancePath +
                                              "/items/" +
                                              i0 +
                                              "/availableProblemCount",
                                            schemaPath:
                                              "#/components/schemas/Skill/properties/availableProblemCount/type",
                                            keyword: "type",
                                            params: { type: "integer" },
                                            message: "must be integer",
                                          },
                                        ];
                                        return false;
                                      }
                                      if (errors === _errs20) {
                                        if (typeof data8 == "number") {
                                          if (data8 < 0 || isNaN(data8)) {
                                            validate97.errors = [
                                              {
                                                instancePath:
                                                  instancePath +
                                                  "/items/" +
                                                  i0 +
                                                  "/availableProblemCount",
                                                schemaPath:
                                                  "#/components/schemas/Skill/properties/availableProblemCount/minimum",
                                                keyword: "minimum",
                                                params: {
                                                  comparison: ">=",
                                                  limit: 0,
                                                },
                                                message: "must be >= 0",
                                              },
                                            ];
                                            return false;
                                          } else {
                                            if (!formats0.validate(data8)) {
                                              validate97.errors = [
                                                {
                                                  instancePath:
                                                    instancePath +
                                                    "/items/" +
                                                    i0 +
                                                    "/availableProblemCount",
                                                  schemaPath:
                                                    "#/components/schemas/Skill/properties/availableProblemCount/format",
                                                  keyword: "format",
                                                  params: { format: "int32" },
                                                  message:
                                                    'must match format "' +
                                                    "int32" +
                                                    '"',
                                                },
                                              ];
                                              return false;
                                            }
                                          }
                                        }
                                      }
                                      var valid3 = _errs20 === errors;
                                    } else {
                                      var valid3 = true;
                                    }
                                    if (valid3) {
                                      if (data1.availability !== undefined) {
                                        let data9 = data1.availability;
                                        const _errs22 = errors;
                                        if (typeof data9 !== "string") {
                                          validate97.errors = [
                                            {
                                              instancePath:
                                                instancePath +
                                                "/items/" +
                                                i0 +
                                                "/availability",
                                              schemaPath:
                                                "#/components/schemas/Skill/properties/availability/type",
                                              keyword: "type",
                                              params: { type: "string" },
                                              message: "must be string",
                                            },
                                          ];
                                          return false;
                                        }
                                        if (
                                          !(
                                            data9 === "available" ||
                                            data9 === "unavailable"
                                          )
                                        ) {
                                          validate97.errors = [
                                            {
                                              instancePath:
                                                instancePath +
                                                "/items/" +
                                                i0 +
                                                "/availability",
                                              schemaPath:
                                                "#/components/schemas/Skill/properties/availability/enum",
                                              keyword: "enum",
                                              params: {
                                                allowedValues:
                                                  schema109.properties
                                                    .availability.enum,
                                              },
                                              message:
                                                "must be equal to one of the allowed values",
                                            },
                                          ];
                                          return false;
                                        }
                                        var valid3 = _errs22 === errors;
                                      } else {
                                        var valid3 = true;
                                      }
                                    }
                                  }
                                }
                              }
                            }
                          }
                        }
                      }
                    } else {
                      validate97.errors = [
                        {
                          instancePath: instancePath + "/items/" + i0,
                          schemaPath: "#/components/schemas/Skill/type",
                          keyword: "type",
                          params: { type: "object" },
                          message: "must be object",
                        },
                      ];
                      return false;
                    }
                  }
                  var valid1 = _errs4 === errors;
                  if (!valid1) {
                    break;
                  }
                }
              } else {
                validate97.errors = [
                  {
                    instancePath: instancePath + "/items",
                    schemaPath: "#/properties/items/type",
                    keyword: "type",
                    params: { type: "array" },
                    message: "must be array",
                  },
                ];
                return false;
              }
            }
          }
        }
      }
    } else {
      validate97.errors = [
        {
          instancePath,
          schemaPath: "#/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        },
      ];
      return false;
    }
  }
  validate97.errors = vErrors;
  return errors === 0;
}
validate97.evaluated = {
  props: true,
  dynamicProps: false,
  dynamicItems: false,
};
function validate96(
  data,
  {
    instancePath = "",
    parentData,
    parentDataProperty,
    rootData = data,
    dynamicAnchors = {},
  } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate96.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (errors === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (
        (data.data === undefined && (missing0 = "data")) ||
        (data.meta === undefined && (missing0 = "meta"))
      ) {
        validate96.errors = [
          {
            instancePath,
            schemaPath: "#/required",
            keyword: "required",
            params: { missingProperty: missing0 },
            message: "must have required property '" + missing0 + "'",
          },
        ];
        return false;
      } else {
        const _errs1 = errors;
        for (const key0 in data) {
          if (!(key0 === "data" || key0 === "meta")) {
            validate96.errors = [
              {
                instancePath,
                schemaPath: "#/additionalProperties",
                keyword: "additionalProperties",
                params: { additionalProperty: key0 },
                message: "must NOT have additional properties",
              },
            ];
            return false;
            break;
          }
        }
        if (_errs1 === errors) {
          if (data.data !== undefined) {
            const _errs2 = errors;
            if (
              !validate97(data.data, {
                instancePath: instancePath + "/data",
                parentData: data,
                parentDataProperty: "data",
                rootData,
                dynamicAnchors,
              })
            ) {
              vErrors =
                vErrors === null
                  ? validate97.errors
                  : vErrors.concat(validate97.errors);
              errors = vErrors.length;
            }
            var valid0 = _errs2 === errors;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.meta !== undefined) {
              let data1 = data.meta;
              const _errs3 = errors;
              const _errs4 = errors;
              if (errors === _errs4) {
                if (
                  data1 &&
                  typeof data1 == "object" &&
                  !Array.isArray(data1)
                ) {
                  let missing1;
                  if (
                    (data1.requestId === undefined &&
                      (missing1 = "requestId")) ||
                    (data1.serverTime === undefined &&
                      (missing1 = "serverTime")) ||
                    (data1.apiVersion === undefined &&
                      (missing1 = "apiVersion"))
                  ) {
                    validate96.errors = [
                      {
                        instancePath: instancePath + "/meta",
                        schemaPath: "#/components/schemas/Meta/required",
                        keyword: "required",
                        params: { missingProperty: missing1 },
                        message:
                          "must have required property '" + missing1 + "'",
                      },
                    ];
                    return false;
                  } else {
                    const _errs6 = errors;
                    for (const key1 in data1) {
                      if (
                        !(
                          key1 === "requestId" ||
                          key1 === "serverTime" ||
                          key1 === "apiVersion"
                        )
                      ) {
                        validate96.errors = [
                          {
                            instancePath: instancePath + "/meta",
                            schemaPath:
                              "#/components/schemas/Meta/additionalProperties",
                            keyword: "additionalProperties",
                            params: { additionalProperty: key1 },
                            message: "must NOT have additional properties",
                          },
                        ];
                        return false;
                        break;
                      }
                    }
                    if (_errs6 === errors) {
                      if (data1.requestId !== undefined) {
                        let data2 = data1.requestId;
                        const _errs7 = errors;
                        if (errors === _errs7) {
                          if (errors === _errs7) {
                            if (typeof data2 === "string") {
                              if (!formats4.test(data2)) {
                                validate96.errors = [
                                  {
                                    instancePath:
                                      instancePath + "/meta/requestId",
                                    schemaPath:
                                      "#/components/schemas/Meta/properties/requestId/format",
                                    keyword: "format",
                                    params: { format: "uuid" },
                                    message:
                                      'must match format "' + "uuid" + '"',
                                  },
                                ];
                                return false;
                              }
                            } else {
                              validate96.errors = [
                                {
                                  instancePath:
                                    instancePath + "/meta/requestId",
                                  schemaPath:
                                    "#/components/schemas/Meta/properties/requestId/type",
                                  keyword: "type",
                                  params: { type: "string" },
                                  message: "must be string",
                                },
                              ];
                              return false;
                            }
                          }
                        }
                        var valid2 = _errs7 === errors;
                      } else {
                        var valid2 = true;
                      }
                      if (valid2) {
                        if (data1.serverTime !== undefined) {
                          let data3 = data1.serverTime;
                          const _errs9 = errors;
                          if (errors === _errs9) {
                            if (errors === _errs9) {
                              if (typeof data3 === "string") {
                                if (!formats6.validate(data3)) {
                                  validate96.errors = [
                                    {
                                      instancePath:
                                        instancePath + "/meta/serverTime",
                                      schemaPath:
                                        "#/components/schemas/Meta/properties/serverTime/format",
                                      keyword: "format",
                                      params: { format: "date-time" },
                                      message:
                                        'must match format "' +
                                        "date-time" +
                                        '"',
                                    },
                                  ];
                                  return false;
                                }
                              } else {
                                validate96.errors = [
                                  {
                                    instancePath:
                                      instancePath + "/meta/serverTime",
                                    schemaPath:
                                      "#/components/schemas/Meta/properties/serverTime/type",
                                    keyword: "type",
                                    params: { type: "string" },
                                    message: "must be string",
                                  },
                                ];
                                return false;
                              }
                            }
                          }
                          var valid2 = _errs9 === errors;
                        } else {
                          var valid2 = true;
                        }
                        if (valid2) {
                          if (data1.apiVersion !== undefined) {
                            const _errs11 = errors;
                            if (typeof data1.apiVersion !== "string") {
                              validate96.errors = [
                                {
                                  instancePath:
                                    instancePath + "/meta/apiVersion",
                                  schemaPath:
                                    "#/components/schemas/Meta/properties/apiVersion/type",
                                  keyword: "type",
                                  params: { type: "string" },
                                  message: "must be string",
                                },
                              ];
                              return false;
                            }
                            var valid2 = _errs11 === errors;
                          } else {
                            var valid2 = true;
                          }
                        }
                      }
                    }
                  }
                } else {
                  validate96.errors = [
                    {
                      instancePath: instancePath + "/meta",
                      schemaPath: "#/components/schemas/Meta/type",
                      keyword: "type",
                      params: { type: "object" },
                      message: "must be object",
                    },
                  ];
                  return false;
                }
              }
              var valid0 = _errs3 === errors;
            } else {
              var valid0 = true;
            }
          }
        }
      }
    } else {
      validate96.errors = [
        {
          instancePath,
          schemaPath: "#/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        },
      ];
      return false;
    }
  }
  validate96.errors = vErrors;
  return errors === 0;
}
validate96.evaluated = {
  props: true,
  dynamicProps: false,
  dynamicItems: false,
};
exports.LearningSessionEnvelope = validate99;
const schema111 = {
  type: "object",
  additionalProperties: false,
  properties: {
    data: { $ref: "#/components/schemas/LearningSession" },
    meta: { $ref: "#/components/schemas/Meta" },
  },
  required: ["data", "meta"],
};
const schema112 = {
  type: "object",
  additionalProperties: false,
  properties: {
    id: { type: "string", format: "uuid" },
    status: { type: "string", enum: ["active", "ended", "abandoned"] },
    releaseId: { type: "string", format: "uuid" },
    startedAt: { type: "string", format: "date-time" },
    endedAt: {
      anyOf: [{ type: "string", format: "date-time" }, { type: "null" }],
    },
    isSynthetic: {
      type: "boolean",
      description: "تكون false دائمًا في جلسات الطلاب الحقيقيين.",
    },
  },
  required: [
    "id",
    "status",
    "releaseId",
    "startedAt",
    "endedAt",
    "isSynthetic",
  ],
};
function validate99(
  data,
  {
    instancePath = "",
    parentData,
    parentDataProperty,
    rootData = data,
    dynamicAnchors = {},
  } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate99.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (errors === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (
        (data.data === undefined && (missing0 = "data")) ||
        (data.meta === undefined && (missing0 = "meta"))
      ) {
        validate99.errors = [
          {
            instancePath,
            schemaPath: "#/required",
            keyword: "required",
            params: { missingProperty: missing0 },
            message: "must have required property '" + missing0 + "'",
          },
        ];
        return false;
      } else {
        const _errs1 = errors;
        for (const key0 in data) {
          if (!(key0 === "data" || key0 === "meta")) {
            validate99.errors = [
              {
                instancePath,
                schemaPath: "#/additionalProperties",
                keyword: "additionalProperties",
                params: { additionalProperty: key0 },
                message: "must NOT have additional properties",
              },
            ];
            return false;
            break;
          }
        }
        if (_errs1 === errors) {
          if (data.data !== undefined) {
            let data0 = data.data;
            const _errs2 = errors;
            const _errs3 = errors;
            if (errors === _errs3) {
              if (data0 && typeof data0 == "object" && !Array.isArray(data0)) {
                let missing1;
                if (
                  (data0.id === undefined && (missing1 = "id")) ||
                  (data0.status === undefined && (missing1 = "status")) ||
                  (data0.releaseId === undefined && (missing1 = "releaseId")) ||
                  (data0.startedAt === undefined && (missing1 = "startedAt")) ||
                  (data0.endedAt === undefined && (missing1 = "endedAt")) ||
                  (data0.isSynthetic === undefined &&
                    (missing1 = "isSynthetic"))
                ) {
                  validate99.errors = [
                    {
                      instancePath: instancePath + "/data",
                      schemaPath:
                        "#/components/schemas/LearningSession/required",
                      keyword: "required",
                      params: { missingProperty: missing1 },
                      message: "must have required property '" + missing1 + "'",
                    },
                  ];
                  return false;
                } else {
                  const _errs5 = errors;
                  for (const key1 in data0) {
                    if (
                      !(
                        key1 === "id" ||
                        key1 === "status" ||
                        key1 === "releaseId" ||
                        key1 === "startedAt" ||
                        key1 === "endedAt" ||
                        key1 === "isSynthetic"
                      )
                    ) {
                      validate99.errors = [
                        {
                          instancePath: instancePath + "/data",
                          schemaPath:
                            "#/components/schemas/LearningSession/additionalProperties",
                          keyword: "additionalProperties",
                          params: { additionalProperty: key1 },
                          message: "must NOT have additional properties",
                        },
                      ];
                      return false;
                      break;
                    }
                  }
                  if (_errs5 === errors) {
                    if (data0.id !== undefined) {
                      let data1 = data0.id;
                      const _errs6 = errors;
                      if (errors === _errs6) {
                        if (errors === _errs6) {
                          if (typeof data1 === "string") {
                            if (!formats4.test(data1)) {
                              validate99.errors = [
                                {
                                  instancePath: instancePath + "/data/id",
                                  schemaPath:
                                    "#/components/schemas/LearningSession/properties/id/format",
                                  keyword: "format",
                                  params: { format: "uuid" },
                                  message: 'must match format "' + "uuid" + '"',
                                },
                              ];
                              return false;
                            }
                          } else {
                            validate99.errors = [
                              {
                                instancePath: instancePath + "/data/id",
                                schemaPath:
                                  "#/components/schemas/LearningSession/properties/id/type",
                                keyword: "type",
                                params: { type: "string" },
                                message: "must be string",
                              },
                            ];
                            return false;
                          }
                        }
                      }
                      var valid2 = _errs6 === errors;
                    } else {
                      var valid2 = true;
                    }
                    if (valid2) {
                      if (data0.status !== undefined) {
                        let data2 = data0.status;
                        const _errs8 = errors;
                        if (typeof data2 !== "string") {
                          validate99.errors = [
                            {
                              instancePath: instancePath + "/data/status",
                              schemaPath:
                                "#/components/schemas/LearningSession/properties/status/type",
                              keyword: "type",
                              params: { type: "string" },
                              message: "must be string",
                            },
                          ];
                          return false;
                        }
                        if (
                          !(
                            data2 === "active" ||
                            data2 === "ended" ||
                            data2 === "abandoned"
                          )
                        ) {
                          validate99.errors = [
                            {
                              instancePath: instancePath + "/data/status",
                              schemaPath:
                                "#/components/schemas/LearningSession/properties/status/enum",
                              keyword: "enum",
                              params: {
                                allowedValues: schema112.properties.status.enum,
                              },
                              message:
                                "must be equal to one of the allowed values",
                            },
                          ];
                          return false;
                        }
                        var valid2 = _errs8 === errors;
                      } else {
                        var valid2 = true;
                      }
                      if (valid2) {
                        if (data0.releaseId !== undefined) {
                          let data3 = data0.releaseId;
                          const _errs10 = errors;
                          if (errors === _errs10) {
                            if (errors === _errs10) {
                              if (typeof data3 === "string") {
                                if (!formats4.test(data3)) {
                                  validate99.errors = [
                                    {
                                      instancePath:
                                        instancePath + "/data/releaseId",
                                      schemaPath:
                                        "#/components/schemas/LearningSession/properties/releaseId/format",
                                      keyword: "format",
                                      params: { format: "uuid" },
                                      message:
                                        'must match format "' + "uuid" + '"',
                                    },
                                  ];
                                  return false;
                                }
                              } else {
                                validate99.errors = [
                                  {
                                    instancePath:
                                      instancePath + "/data/releaseId",
                                    schemaPath:
                                      "#/components/schemas/LearningSession/properties/releaseId/type",
                                    keyword: "type",
                                    params: { type: "string" },
                                    message: "must be string",
                                  },
                                ];
                                return false;
                              }
                            }
                          }
                          var valid2 = _errs10 === errors;
                        } else {
                          var valid2 = true;
                        }
                        if (valid2) {
                          if (data0.startedAt !== undefined) {
                            let data4 = data0.startedAt;
                            const _errs12 = errors;
                            if (errors === _errs12) {
                              if (errors === _errs12) {
                                if (typeof data4 === "string") {
                                  if (!formats6.validate(data4)) {
                                    validate99.errors = [
                                      {
                                        instancePath:
                                          instancePath + "/data/startedAt",
                                        schemaPath:
                                          "#/components/schemas/LearningSession/properties/startedAt/format",
                                        keyword: "format",
                                        params: { format: "date-time" },
                                        message:
                                          'must match format "' +
                                          "date-time" +
                                          '"',
                                      },
                                    ];
                                    return false;
                                  }
                                } else {
                                  validate99.errors = [
                                    {
                                      instancePath:
                                        instancePath + "/data/startedAt",
                                      schemaPath:
                                        "#/components/schemas/LearningSession/properties/startedAt/type",
                                      keyword: "type",
                                      params: { type: "string" },
                                      message: "must be string",
                                    },
                                  ];
                                  return false;
                                }
                              }
                            }
                            var valid2 = _errs12 === errors;
                          } else {
                            var valid2 = true;
                          }
                          if (valid2) {
                            if (data0.endedAt !== undefined) {
                              let data5 = data0.endedAt;
                              const _errs14 = errors;
                              const _errs15 = errors;
                              let valid3 = false;
                              const _errs16 = errors;
                              if (errors === _errs16) {
                                if (errors === _errs16) {
                                  if (typeof data5 === "string") {
                                    if (!formats6.validate(data5)) {
                                      const err0 = {
                                        instancePath:
                                          instancePath + "/data/endedAt",
                                        schemaPath:
                                          "#/components/schemas/LearningSession/properties/endedAt/anyOf/0/format",
                                        keyword: "format",
                                        params: { format: "date-time" },
                                        message:
                                          'must match format "' +
                                          "date-time" +
                                          '"',
                                      };
                                      if (vErrors === null) {
                                        vErrors = [err0];
                                      } else {
                                        vErrors.push(err0);
                                      }
                                      errors++;
                                    }
                                  } else {
                                    const err1 = {
                                      instancePath:
                                        instancePath + "/data/endedAt",
                                      schemaPath:
                                        "#/components/schemas/LearningSession/properties/endedAt/anyOf/0/type",
                                      keyword: "type",
                                      params: { type: "string" },
                                      message: "must be string",
                                    };
                                    if (vErrors === null) {
                                      vErrors = [err1];
                                    } else {
                                      vErrors.push(err1);
                                    }
                                    errors++;
                                  }
                                }
                              }
                              var _valid0 = _errs16 === errors;
                              valid3 = valid3 || _valid0;
                              const _errs18 = errors;
                              if (data5 !== null) {
                                const err2 = {
                                  instancePath: instancePath + "/data/endedAt",
                                  schemaPath:
                                    "#/components/schemas/LearningSession/properties/endedAt/anyOf/1/type",
                                  keyword: "type",
                                  params: { type: "null" },
                                  message: "must be null",
                                };
                                if (vErrors === null) {
                                  vErrors = [err2];
                                } else {
                                  vErrors.push(err2);
                                }
                                errors++;
                              }
                              var _valid0 = _errs18 === errors;
                              valid3 = valid3 || _valid0;
                              if (!valid3) {
                                const err3 = {
                                  instancePath: instancePath + "/data/endedAt",
                                  schemaPath:
                                    "#/components/schemas/LearningSession/properties/endedAt/anyOf",
                                  keyword: "anyOf",
                                  params: {},
                                  message: "must match a schema in anyOf",
                                };
                                if (vErrors === null) {
                                  vErrors = [err3];
                                } else {
                                  vErrors.push(err3);
                                }
                                errors++;
                                validate99.errors = vErrors;
                                return false;
                              } else {
                                errors = _errs15;
                                if (vErrors !== null) {
                                  if (_errs15) {
                                    vErrors.length = _errs15;
                                  } else {
                                    vErrors = null;
                                  }
                                }
                              }
                              var valid2 = _errs14 === errors;
                            } else {
                              var valid2 = true;
                            }
                            if (valid2) {
                              if (data0.isSynthetic !== undefined) {
                                const _errs20 = errors;
                                if (typeof data0.isSynthetic !== "boolean") {
                                  validate99.errors = [
                                    {
                                      instancePath:
                                        instancePath + "/data/isSynthetic",
                                      schemaPath:
                                        "#/components/schemas/LearningSession/properties/isSynthetic/type",
                                      keyword: "type",
                                      params: { type: "boolean" },
                                      message: "must be boolean",
                                    },
                                  ];
                                  return false;
                                }
                                var valid2 = _errs20 === errors;
                              } else {
                                var valid2 = true;
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              } else {
                validate99.errors = [
                  {
                    instancePath: instancePath + "/data",
                    schemaPath: "#/components/schemas/LearningSession/type",
                    keyword: "type",
                    params: { type: "object" },
                    message: "must be object",
                  },
                ];
                return false;
              }
            }
            var valid0 = _errs2 === errors;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.meta !== undefined) {
              let data7 = data.meta;
              const _errs22 = errors;
              const _errs23 = errors;
              if (errors === _errs23) {
                if (
                  data7 &&
                  typeof data7 == "object" &&
                  !Array.isArray(data7)
                ) {
                  let missing2;
                  if (
                    (data7.requestId === undefined &&
                      (missing2 = "requestId")) ||
                    (data7.serverTime === undefined &&
                      (missing2 = "serverTime")) ||
                    (data7.apiVersion === undefined &&
                      (missing2 = "apiVersion"))
                  ) {
                    validate99.errors = [
                      {
                        instancePath: instancePath + "/meta",
                        schemaPath: "#/components/schemas/Meta/required",
                        keyword: "required",
                        params: { missingProperty: missing2 },
                        message:
                          "must have required property '" + missing2 + "'",
                      },
                    ];
                    return false;
                  } else {
                    const _errs25 = errors;
                    for (const key2 in data7) {
                      if (
                        !(
                          key2 === "requestId" ||
                          key2 === "serverTime" ||
                          key2 === "apiVersion"
                        )
                      ) {
                        validate99.errors = [
                          {
                            instancePath: instancePath + "/meta",
                            schemaPath:
                              "#/components/schemas/Meta/additionalProperties",
                            keyword: "additionalProperties",
                            params: { additionalProperty: key2 },
                            message: "must NOT have additional properties",
                          },
                        ];
                        return false;
                        break;
                      }
                    }
                    if (_errs25 === errors) {
                      if (data7.requestId !== undefined) {
                        let data8 = data7.requestId;
                        const _errs26 = errors;
                        if (errors === _errs26) {
                          if (errors === _errs26) {
                            if (typeof data8 === "string") {
                              if (!formats4.test(data8)) {
                                validate99.errors = [
                                  {
                                    instancePath:
                                      instancePath + "/meta/requestId",
                                    schemaPath:
                                      "#/components/schemas/Meta/properties/requestId/format",
                                    keyword: "format",
                                    params: { format: "uuid" },
                                    message:
                                      'must match format "' + "uuid" + '"',
                                  },
                                ];
                                return false;
                              }
                            } else {
                              validate99.errors = [
                                {
                                  instancePath:
                                    instancePath + "/meta/requestId",
                                  schemaPath:
                                    "#/components/schemas/Meta/properties/requestId/type",
                                  keyword: "type",
                                  params: { type: "string" },
                                  message: "must be string",
                                },
                              ];
                              return false;
                            }
                          }
                        }
                        var valid5 = _errs26 === errors;
                      } else {
                        var valid5 = true;
                      }
                      if (valid5) {
                        if (data7.serverTime !== undefined) {
                          let data9 = data7.serverTime;
                          const _errs28 = errors;
                          if (errors === _errs28) {
                            if (errors === _errs28) {
                              if (typeof data9 === "string") {
                                if (!formats6.validate(data9)) {
                                  validate99.errors = [
                                    {
                                      instancePath:
                                        instancePath + "/meta/serverTime",
                                      schemaPath:
                                        "#/components/schemas/Meta/properties/serverTime/format",
                                      keyword: "format",
                                      params: { format: "date-time" },
                                      message:
                                        'must match format "' +
                                        "date-time" +
                                        '"',
                                    },
                                  ];
                                  return false;
                                }
                              } else {
                                validate99.errors = [
                                  {
                                    instancePath:
                                      instancePath + "/meta/serverTime",
                                    schemaPath:
                                      "#/components/schemas/Meta/properties/serverTime/type",
                                    keyword: "type",
                                    params: { type: "string" },
                                    message: "must be string",
                                  },
                                ];
                                return false;
                              }
                            }
                          }
                          var valid5 = _errs28 === errors;
                        } else {
                          var valid5 = true;
                        }
                        if (valid5) {
                          if (data7.apiVersion !== undefined) {
                            const _errs30 = errors;
                            if (typeof data7.apiVersion !== "string") {
                              validate99.errors = [
                                {
                                  instancePath:
                                    instancePath + "/meta/apiVersion",
                                  schemaPath:
                                    "#/components/schemas/Meta/properties/apiVersion/type",
                                  keyword: "type",
                                  params: { type: "string" },
                                  message: "must be string",
                                },
                              ];
                              return false;
                            }
                            var valid5 = _errs30 === errors;
                          } else {
                            var valid5 = true;
                          }
                        }
                      }
                    }
                  }
                } else {
                  validate99.errors = [
                    {
                      instancePath: instancePath + "/meta",
                      schemaPath: "#/components/schemas/Meta/type",
                      keyword: "type",
                      params: { type: "object" },
                      message: "must be object",
                    },
                  ];
                  return false;
                }
              }
              var valid0 = _errs22 === errors;
            } else {
              var valid0 = true;
            }
          }
        }
      }
    } else {
      validate99.errors = [
        {
          instancePath,
          schemaPath: "#/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        },
      ];
      return false;
    }
  }
  validate99.errors = vErrors;
  return errors === 0;
}
validate99.evaluated = {
  props: true,
  dynamicProps: false,
  dynamicItems: false,
};
exports.GuestCurrentEnvelope = validate100;
const schema114 = {
  type: "object",
  additionalProperties: false,
  properties: {
    data: { $ref: "#/components/schemas/GuestSession" },
    meta: { $ref: "#/components/schemas/Meta" },
  },
  required: ["data", "meta"],
};
const schema115 = {
  type: "object",
  additionalProperties: false,
  properties: {
    id: { type: "string", format: "uuid" },
    status: { type: "string", enum: ["active", "expired", "revoked"] },
    expiresAt: { type: "string", format: "date-time" },
    createdAt: { type: "string", format: "date-time" },
  },
  required: ["id", "status", "expiresAt", "createdAt"],
};
function validate100(
  data,
  {
    instancePath = "",
    parentData,
    parentDataProperty,
    rootData = data,
    dynamicAnchors = {},
  } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate100.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (errors === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (
        (data.data === undefined && (missing0 = "data")) ||
        (data.meta === undefined && (missing0 = "meta"))
      ) {
        validate100.errors = [
          {
            instancePath,
            schemaPath: "#/required",
            keyword: "required",
            params: { missingProperty: missing0 },
            message: "must have required property '" + missing0 + "'",
          },
        ];
        return false;
      } else {
        const _errs1 = errors;
        for (const key0 in data) {
          if (!(key0 === "data" || key0 === "meta")) {
            validate100.errors = [
              {
                instancePath,
                schemaPath: "#/additionalProperties",
                keyword: "additionalProperties",
                params: { additionalProperty: key0 },
                message: "must NOT have additional properties",
              },
            ];
            return false;
            break;
          }
        }
        if (_errs1 === errors) {
          if (data.data !== undefined) {
            let data0 = data.data;
            const _errs2 = errors;
            const _errs3 = errors;
            if (errors === _errs3) {
              if (data0 && typeof data0 == "object" && !Array.isArray(data0)) {
                let missing1;
                if (
                  (data0.id === undefined && (missing1 = "id")) ||
                  (data0.status === undefined && (missing1 = "status")) ||
                  (data0.expiresAt === undefined && (missing1 = "expiresAt")) ||
                  (data0.createdAt === undefined && (missing1 = "createdAt"))
                ) {
                  validate100.errors = [
                    {
                      instancePath: instancePath + "/data",
                      schemaPath: "#/components/schemas/GuestSession/required",
                      keyword: "required",
                      params: { missingProperty: missing1 },
                      message: "must have required property '" + missing1 + "'",
                    },
                  ];
                  return false;
                } else {
                  const _errs5 = errors;
                  for (const key1 in data0) {
                    if (
                      !(
                        key1 === "id" ||
                        key1 === "status" ||
                        key1 === "expiresAt" ||
                        key1 === "createdAt"
                      )
                    ) {
                      validate100.errors = [
                        {
                          instancePath: instancePath + "/data",
                          schemaPath:
                            "#/components/schemas/GuestSession/additionalProperties",
                          keyword: "additionalProperties",
                          params: { additionalProperty: key1 },
                          message: "must NOT have additional properties",
                        },
                      ];
                      return false;
                      break;
                    }
                  }
                  if (_errs5 === errors) {
                    if (data0.id !== undefined) {
                      let data1 = data0.id;
                      const _errs6 = errors;
                      if (errors === _errs6) {
                        if (errors === _errs6) {
                          if (typeof data1 === "string") {
                            if (!formats4.test(data1)) {
                              validate100.errors = [
                                {
                                  instancePath: instancePath + "/data/id",
                                  schemaPath:
                                    "#/components/schemas/GuestSession/properties/id/format",
                                  keyword: "format",
                                  params: { format: "uuid" },
                                  message: 'must match format "' + "uuid" + '"',
                                },
                              ];
                              return false;
                            }
                          } else {
                            validate100.errors = [
                              {
                                instancePath: instancePath + "/data/id",
                                schemaPath:
                                  "#/components/schemas/GuestSession/properties/id/type",
                                keyword: "type",
                                params: { type: "string" },
                                message: "must be string",
                              },
                            ];
                            return false;
                          }
                        }
                      }
                      var valid2 = _errs6 === errors;
                    } else {
                      var valid2 = true;
                    }
                    if (valid2) {
                      if (data0.status !== undefined) {
                        let data2 = data0.status;
                        const _errs8 = errors;
                        if (typeof data2 !== "string") {
                          validate100.errors = [
                            {
                              instancePath: instancePath + "/data/status",
                              schemaPath:
                                "#/components/schemas/GuestSession/properties/status/type",
                              keyword: "type",
                              params: { type: "string" },
                              message: "must be string",
                            },
                          ];
                          return false;
                        }
                        if (
                          !(
                            data2 === "active" ||
                            data2 === "expired" ||
                            data2 === "revoked"
                          )
                        ) {
                          validate100.errors = [
                            {
                              instancePath: instancePath + "/data/status",
                              schemaPath:
                                "#/components/schemas/GuestSession/properties/status/enum",
                              keyword: "enum",
                              params: {
                                allowedValues: schema115.properties.status.enum,
                              },
                              message:
                                "must be equal to one of the allowed values",
                            },
                          ];
                          return false;
                        }
                        var valid2 = _errs8 === errors;
                      } else {
                        var valid2 = true;
                      }
                      if (valid2) {
                        if (data0.expiresAt !== undefined) {
                          let data3 = data0.expiresAt;
                          const _errs10 = errors;
                          if (errors === _errs10) {
                            if (errors === _errs10) {
                              if (typeof data3 === "string") {
                                if (!formats6.validate(data3)) {
                                  validate100.errors = [
                                    {
                                      instancePath:
                                        instancePath + "/data/expiresAt",
                                      schemaPath:
                                        "#/components/schemas/GuestSession/properties/expiresAt/format",
                                      keyword: "format",
                                      params: { format: "date-time" },
                                      message:
                                        'must match format "' +
                                        "date-time" +
                                        '"',
                                    },
                                  ];
                                  return false;
                                }
                              } else {
                                validate100.errors = [
                                  {
                                    instancePath:
                                      instancePath + "/data/expiresAt",
                                    schemaPath:
                                      "#/components/schemas/GuestSession/properties/expiresAt/type",
                                    keyword: "type",
                                    params: { type: "string" },
                                    message: "must be string",
                                  },
                                ];
                                return false;
                              }
                            }
                          }
                          var valid2 = _errs10 === errors;
                        } else {
                          var valid2 = true;
                        }
                        if (valid2) {
                          if (data0.createdAt !== undefined) {
                            let data4 = data0.createdAt;
                            const _errs12 = errors;
                            if (errors === _errs12) {
                              if (errors === _errs12) {
                                if (typeof data4 === "string") {
                                  if (!formats6.validate(data4)) {
                                    validate100.errors = [
                                      {
                                        instancePath:
                                          instancePath + "/data/createdAt",
                                        schemaPath:
                                          "#/components/schemas/GuestSession/properties/createdAt/format",
                                        keyword: "format",
                                        params: { format: "date-time" },
                                        message:
                                          'must match format "' +
                                          "date-time" +
                                          '"',
                                      },
                                    ];
                                    return false;
                                  }
                                } else {
                                  validate100.errors = [
                                    {
                                      instancePath:
                                        instancePath + "/data/createdAt",
                                      schemaPath:
                                        "#/components/schemas/GuestSession/properties/createdAt/type",
                                      keyword: "type",
                                      params: { type: "string" },
                                      message: "must be string",
                                    },
                                  ];
                                  return false;
                                }
                              }
                            }
                            var valid2 = _errs12 === errors;
                          } else {
                            var valid2 = true;
                          }
                        }
                      }
                    }
                  }
                }
              } else {
                validate100.errors = [
                  {
                    instancePath: instancePath + "/data",
                    schemaPath: "#/components/schemas/GuestSession/type",
                    keyword: "type",
                    params: { type: "object" },
                    message: "must be object",
                  },
                ];
                return false;
              }
            }
            var valid0 = _errs2 === errors;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.meta !== undefined) {
              let data5 = data.meta;
              const _errs14 = errors;
              const _errs15 = errors;
              if (errors === _errs15) {
                if (
                  data5 &&
                  typeof data5 == "object" &&
                  !Array.isArray(data5)
                ) {
                  let missing2;
                  if (
                    (data5.requestId === undefined &&
                      (missing2 = "requestId")) ||
                    (data5.serverTime === undefined &&
                      (missing2 = "serverTime")) ||
                    (data5.apiVersion === undefined &&
                      (missing2 = "apiVersion"))
                  ) {
                    validate100.errors = [
                      {
                        instancePath: instancePath + "/meta",
                        schemaPath: "#/components/schemas/Meta/required",
                        keyword: "required",
                        params: { missingProperty: missing2 },
                        message:
                          "must have required property '" + missing2 + "'",
                      },
                    ];
                    return false;
                  } else {
                    const _errs17 = errors;
                    for (const key2 in data5) {
                      if (
                        !(
                          key2 === "requestId" ||
                          key2 === "serverTime" ||
                          key2 === "apiVersion"
                        )
                      ) {
                        validate100.errors = [
                          {
                            instancePath: instancePath + "/meta",
                            schemaPath:
                              "#/components/schemas/Meta/additionalProperties",
                            keyword: "additionalProperties",
                            params: { additionalProperty: key2 },
                            message: "must NOT have additional properties",
                          },
                        ];
                        return false;
                        break;
                      }
                    }
                    if (_errs17 === errors) {
                      if (data5.requestId !== undefined) {
                        let data6 = data5.requestId;
                        const _errs18 = errors;
                        if (errors === _errs18) {
                          if (errors === _errs18) {
                            if (typeof data6 === "string") {
                              if (!formats4.test(data6)) {
                                validate100.errors = [
                                  {
                                    instancePath:
                                      instancePath + "/meta/requestId",
                                    schemaPath:
                                      "#/components/schemas/Meta/properties/requestId/format",
                                    keyword: "format",
                                    params: { format: "uuid" },
                                    message:
                                      'must match format "' + "uuid" + '"',
                                  },
                                ];
                                return false;
                              }
                            } else {
                              validate100.errors = [
                                {
                                  instancePath:
                                    instancePath + "/meta/requestId",
                                  schemaPath:
                                    "#/components/schemas/Meta/properties/requestId/type",
                                  keyword: "type",
                                  params: { type: "string" },
                                  message: "must be string",
                                },
                              ];
                              return false;
                            }
                          }
                        }
                        var valid4 = _errs18 === errors;
                      } else {
                        var valid4 = true;
                      }
                      if (valid4) {
                        if (data5.serverTime !== undefined) {
                          let data7 = data5.serverTime;
                          const _errs20 = errors;
                          if (errors === _errs20) {
                            if (errors === _errs20) {
                              if (typeof data7 === "string") {
                                if (!formats6.validate(data7)) {
                                  validate100.errors = [
                                    {
                                      instancePath:
                                        instancePath + "/meta/serverTime",
                                      schemaPath:
                                        "#/components/schemas/Meta/properties/serverTime/format",
                                      keyword: "format",
                                      params: { format: "date-time" },
                                      message:
                                        'must match format "' +
                                        "date-time" +
                                        '"',
                                    },
                                  ];
                                  return false;
                                }
                              } else {
                                validate100.errors = [
                                  {
                                    instancePath:
                                      instancePath + "/meta/serverTime",
                                    schemaPath:
                                      "#/components/schemas/Meta/properties/serverTime/type",
                                    keyword: "type",
                                    params: { type: "string" },
                                    message: "must be string",
                                  },
                                ];
                                return false;
                              }
                            }
                          }
                          var valid4 = _errs20 === errors;
                        } else {
                          var valid4 = true;
                        }
                        if (valid4) {
                          if (data5.apiVersion !== undefined) {
                            const _errs22 = errors;
                            if (typeof data5.apiVersion !== "string") {
                              validate100.errors = [
                                {
                                  instancePath:
                                    instancePath + "/meta/apiVersion",
                                  schemaPath:
                                    "#/components/schemas/Meta/properties/apiVersion/type",
                                  keyword: "type",
                                  params: { type: "string" },
                                  message: "must be string",
                                },
                              ];
                              return false;
                            }
                            var valid4 = _errs22 === errors;
                          } else {
                            var valid4 = true;
                          }
                        }
                      }
                    }
                  }
                } else {
                  validate100.errors = [
                    {
                      instancePath: instancePath + "/meta",
                      schemaPath: "#/components/schemas/Meta/type",
                      keyword: "type",
                      params: { type: "object" },
                      message: "must be object",
                    },
                  ];
                  return false;
                }
              }
              var valid0 = _errs14 === errors;
            } else {
              var valid0 = true;
            }
          }
        }
      }
    } else {
      validate100.errors = [
        {
          instancePath,
          schemaPath: "#/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        },
      ];
      return false;
    }
  }
  validate100.errors = vErrors;
  return errors === 0;
}
validate100.evaluated = {
  props: true,
  dynamicProps: false,
  dynamicItems: false,
};
exports.GuestEnvelope = validate101;
const schema117 = {
  type: "object",
  additionalProperties: false,
  properties: {
    data: { $ref: "#/components/schemas/GuestCreateData" },
    meta: { $ref: "#/components/schemas/Meta" },
  },
  required: ["data", "meta"],
};
const schema118 = {
  type: "object",
  additionalProperties: false,
  properties: {
    session: { $ref: "#/components/schemas/GuestSession" },
    csrfToken: {
      type: "string",
      description:
        "رمز حماية جديد إن تم تدويره بعد إصدار الجلسة؛ يستبدل الرمز السابق.",
      minLength: 32,
    },
  },
  required: ["session", "csrfToken"],
};
function validate102(
  data,
  {
    instancePath = "",
    parentData,
    parentDataProperty,
    rootData = data,
    dynamicAnchors = {},
  } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate102.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (errors === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (
        (data.session === undefined && (missing0 = "session")) ||
        (data.csrfToken === undefined && (missing0 = "csrfToken"))
      ) {
        validate102.errors = [
          {
            instancePath,
            schemaPath: "#/required",
            keyword: "required",
            params: { missingProperty: missing0 },
            message: "must have required property '" + missing0 + "'",
          },
        ];
        return false;
      } else {
        const _errs1 = errors;
        for (const key0 in data) {
          if (!(key0 === "session" || key0 === "csrfToken")) {
            validate102.errors = [
              {
                instancePath,
                schemaPath: "#/additionalProperties",
                keyword: "additionalProperties",
                params: { additionalProperty: key0 },
                message: "must NOT have additional properties",
              },
            ];
            return false;
            break;
          }
        }
        if (_errs1 === errors) {
          if (data.session !== undefined) {
            let data0 = data.session;
            const _errs2 = errors;
            const _errs3 = errors;
            if (errors === _errs3) {
              if (data0 && typeof data0 == "object" && !Array.isArray(data0)) {
                let missing1;
                if (
                  (data0.id === undefined && (missing1 = "id")) ||
                  (data0.status === undefined && (missing1 = "status")) ||
                  (data0.expiresAt === undefined && (missing1 = "expiresAt")) ||
                  (data0.createdAt === undefined && (missing1 = "createdAt"))
                ) {
                  validate102.errors = [
                    {
                      instancePath: instancePath + "/session",
                      schemaPath: "#/components/schemas/GuestSession/required",
                      keyword: "required",
                      params: { missingProperty: missing1 },
                      message: "must have required property '" + missing1 + "'",
                    },
                  ];
                  return false;
                } else {
                  const _errs5 = errors;
                  for (const key1 in data0) {
                    if (
                      !(
                        key1 === "id" ||
                        key1 === "status" ||
                        key1 === "expiresAt" ||
                        key1 === "createdAt"
                      )
                    ) {
                      validate102.errors = [
                        {
                          instancePath: instancePath + "/session",
                          schemaPath:
                            "#/components/schemas/GuestSession/additionalProperties",
                          keyword: "additionalProperties",
                          params: { additionalProperty: key1 },
                          message: "must NOT have additional properties",
                        },
                      ];
                      return false;
                      break;
                    }
                  }
                  if (_errs5 === errors) {
                    if (data0.id !== undefined) {
                      let data1 = data0.id;
                      const _errs6 = errors;
                      if (errors === _errs6) {
                        if (errors === _errs6) {
                          if (typeof data1 === "string") {
                            if (!formats4.test(data1)) {
                              validate102.errors = [
                                {
                                  instancePath: instancePath + "/session/id",
                                  schemaPath:
                                    "#/components/schemas/GuestSession/properties/id/format",
                                  keyword: "format",
                                  params: { format: "uuid" },
                                  message: 'must match format "' + "uuid" + '"',
                                },
                              ];
                              return false;
                            }
                          } else {
                            validate102.errors = [
                              {
                                instancePath: instancePath + "/session/id",
                                schemaPath:
                                  "#/components/schemas/GuestSession/properties/id/type",
                                keyword: "type",
                                params: { type: "string" },
                                message: "must be string",
                              },
                            ];
                            return false;
                          }
                        }
                      }
                      var valid2 = _errs6 === errors;
                    } else {
                      var valid2 = true;
                    }
                    if (valid2) {
                      if (data0.status !== undefined) {
                        let data2 = data0.status;
                        const _errs8 = errors;
                        if (typeof data2 !== "string") {
                          validate102.errors = [
                            {
                              instancePath: instancePath + "/session/status",
                              schemaPath:
                                "#/components/schemas/GuestSession/properties/status/type",
                              keyword: "type",
                              params: { type: "string" },
                              message: "must be string",
                            },
                          ];
                          return false;
                        }
                        if (
                          !(
                            data2 === "active" ||
                            data2 === "expired" ||
                            data2 === "revoked"
                          )
                        ) {
                          validate102.errors = [
                            {
                              instancePath: instancePath + "/session/status",
                              schemaPath:
                                "#/components/schemas/GuestSession/properties/status/enum",
                              keyword: "enum",
                              params: {
                                allowedValues: schema115.properties.status.enum,
                              },
                              message:
                                "must be equal to one of the allowed values",
                            },
                          ];
                          return false;
                        }
                        var valid2 = _errs8 === errors;
                      } else {
                        var valid2 = true;
                      }
                      if (valid2) {
                        if (data0.expiresAt !== undefined) {
                          let data3 = data0.expiresAt;
                          const _errs10 = errors;
                          if (errors === _errs10) {
                            if (errors === _errs10) {
                              if (typeof data3 === "string") {
                                if (!formats6.validate(data3)) {
                                  validate102.errors = [
                                    {
                                      instancePath:
                                        instancePath + "/session/expiresAt",
                                      schemaPath:
                                        "#/components/schemas/GuestSession/properties/expiresAt/format",
                                      keyword: "format",
                                      params: { format: "date-time" },
                                      message:
                                        'must match format "' +
                                        "date-time" +
                                        '"',
                                    },
                                  ];
                                  return false;
                                }
                              } else {
                                validate102.errors = [
                                  {
                                    instancePath:
                                      instancePath + "/session/expiresAt",
                                    schemaPath:
                                      "#/components/schemas/GuestSession/properties/expiresAt/type",
                                    keyword: "type",
                                    params: { type: "string" },
                                    message: "must be string",
                                  },
                                ];
                                return false;
                              }
                            }
                          }
                          var valid2 = _errs10 === errors;
                        } else {
                          var valid2 = true;
                        }
                        if (valid2) {
                          if (data0.createdAt !== undefined) {
                            let data4 = data0.createdAt;
                            const _errs12 = errors;
                            if (errors === _errs12) {
                              if (errors === _errs12) {
                                if (typeof data4 === "string") {
                                  if (!formats6.validate(data4)) {
                                    validate102.errors = [
                                      {
                                        instancePath:
                                          instancePath + "/session/createdAt",
                                        schemaPath:
                                          "#/components/schemas/GuestSession/properties/createdAt/format",
                                        keyword: "format",
                                        params: { format: "date-time" },
                                        message:
                                          'must match format "' +
                                          "date-time" +
                                          '"',
                                      },
                                    ];
                                    return false;
                                  }
                                } else {
                                  validate102.errors = [
                                    {
                                      instancePath:
                                        instancePath + "/session/createdAt",
                                      schemaPath:
                                        "#/components/schemas/GuestSession/properties/createdAt/type",
                                      keyword: "type",
                                      params: { type: "string" },
                                      message: "must be string",
                                    },
                                  ];
                                  return false;
                                }
                              }
                            }
                            var valid2 = _errs12 === errors;
                          } else {
                            var valid2 = true;
                          }
                        }
                      }
                    }
                  }
                }
              } else {
                validate102.errors = [
                  {
                    instancePath: instancePath + "/session",
                    schemaPath: "#/components/schemas/GuestSession/type",
                    keyword: "type",
                    params: { type: "object" },
                    message: "must be object",
                  },
                ];
                return false;
              }
            }
            var valid0 = _errs2 === errors;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.csrfToken !== undefined) {
              let data5 = data.csrfToken;
              const _errs14 = errors;
              if (errors === _errs14) {
                if (typeof data5 === "string") {
                  if (func2(data5) < 32) {
                    validate102.errors = [
                      {
                        instancePath: instancePath + "/csrfToken",
                        schemaPath: "#/properties/csrfToken/minLength",
                        keyword: "minLength",
                        params: { limit: 32 },
                        message: "must NOT have fewer than 32 characters",
                      },
                    ];
                    return false;
                  }
                } else {
                  validate102.errors = [
                    {
                      instancePath: instancePath + "/csrfToken",
                      schemaPath: "#/properties/csrfToken/type",
                      keyword: "type",
                      params: { type: "string" },
                      message: "must be string",
                    },
                  ];
                  return false;
                }
              }
              var valid0 = _errs14 === errors;
            } else {
              var valid0 = true;
            }
          }
        }
      }
    } else {
      validate102.errors = [
        {
          instancePath,
          schemaPath: "#/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        },
      ];
      return false;
    }
  }
  validate102.errors = vErrors;
  return errors === 0;
}
validate102.evaluated = {
  props: true,
  dynamicProps: false,
  dynamicItems: false,
};
function validate101(
  data,
  {
    instancePath = "",
    parentData,
    parentDataProperty,
    rootData = data,
    dynamicAnchors = {},
  } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate101.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (errors === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (
        (data.data === undefined && (missing0 = "data")) ||
        (data.meta === undefined && (missing0 = "meta"))
      ) {
        validate101.errors = [
          {
            instancePath,
            schemaPath: "#/required",
            keyword: "required",
            params: { missingProperty: missing0 },
            message: "must have required property '" + missing0 + "'",
          },
        ];
        return false;
      } else {
        const _errs1 = errors;
        for (const key0 in data) {
          if (!(key0 === "data" || key0 === "meta")) {
            validate101.errors = [
              {
                instancePath,
                schemaPath: "#/additionalProperties",
                keyword: "additionalProperties",
                params: { additionalProperty: key0 },
                message: "must NOT have additional properties",
              },
            ];
            return false;
            break;
          }
        }
        if (_errs1 === errors) {
          if (data.data !== undefined) {
            const _errs2 = errors;
            if (
              !validate102(data.data, {
                instancePath: instancePath + "/data",
                parentData: data,
                parentDataProperty: "data",
                rootData,
                dynamicAnchors,
              })
            ) {
              vErrors =
                vErrors === null
                  ? validate102.errors
                  : vErrors.concat(validate102.errors);
              errors = vErrors.length;
            }
            var valid0 = _errs2 === errors;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.meta !== undefined) {
              let data1 = data.meta;
              const _errs3 = errors;
              const _errs4 = errors;
              if (errors === _errs4) {
                if (
                  data1 &&
                  typeof data1 == "object" &&
                  !Array.isArray(data1)
                ) {
                  let missing1;
                  if (
                    (data1.requestId === undefined &&
                      (missing1 = "requestId")) ||
                    (data1.serverTime === undefined &&
                      (missing1 = "serverTime")) ||
                    (data1.apiVersion === undefined &&
                      (missing1 = "apiVersion"))
                  ) {
                    validate101.errors = [
                      {
                        instancePath: instancePath + "/meta",
                        schemaPath: "#/components/schemas/Meta/required",
                        keyword: "required",
                        params: { missingProperty: missing1 },
                        message:
                          "must have required property '" + missing1 + "'",
                      },
                    ];
                    return false;
                  } else {
                    const _errs6 = errors;
                    for (const key1 in data1) {
                      if (
                        !(
                          key1 === "requestId" ||
                          key1 === "serverTime" ||
                          key1 === "apiVersion"
                        )
                      ) {
                        validate101.errors = [
                          {
                            instancePath: instancePath + "/meta",
                            schemaPath:
                              "#/components/schemas/Meta/additionalProperties",
                            keyword: "additionalProperties",
                            params: { additionalProperty: key1 },
                            message: "must NOT have additional properties",
                          },
                        ];
                        return false;
                        break;
                      }
                    }
                    if (_errs6 === errors) {
                      if (data1.requestId !== undefined) {
                        let data2 = data1.requestId;
                        const _errs7 = errors;
                        if (errors === _errs7) {
                          if (errors === _errs7) {
                            if (typeof data2 === "string") {
                              if (!formats4.test(data2)) {
                                validate101.errors = [
                                  {
                                    instancePath:
                                      instancePath + "/meta/requestId",
                                    schemaPath:
                                      "#/components/schemas/Meta/properties/requestId/format",
                                    keyword: "format",
                                    params: { format: "uuid" },
                                    message:
                                      'must match format "' + "uuid" + '"',
                                  },
                                ];
                                return false;
                              }
                            } else {
                              validate101.errors = [
                                {
                                  instancePath:
                                    instancePath + "/meta/requestId",
                                  schemaPath:
                                    "#/components/schemas/Meta/properties/requestId/type",
                                  keyword: "type",
                                  params: { type: "string" },
                                  message: "must be string",
                                },
                              ];
                              return false;
                            }
                          }
                        }
                        var valid2 = _errs7 === errors;
                      } else {
                        var valid2 = true;
                      }
                      if (valid2) {
                        if (data1.serverTime !== undefined) {
                          let data3 = data1.serverTime;
                          const _errs9 = errors;
                          if (errors === _errs9) {
                            if (errors === _errs9) {
                              if (typeof data3 === "string") {
                                if (!formats6.validate(data3)) {
                                  validate101.errors = [
                                    {
                                      instancePath:
                                        instancePath + "/meta/serverTime",
                                      schemaPath:
                                        "#/components/schemas/Meta/properties/serverTime/format",
                                      keyword: "format",
                                      params: { format: "date-time" },
                                      message:
                                        'must match format "' +
                                        "date-time" +
                                        '"',
                                    },
                                  ];
                                  return false;
                                }
                              } else {
                                validate101.errors = [
                                  {
                                    instancePath:
                                      instancePath + "/meta/serverTime",
                                    schemaPath:
                                      "#/components/schemas/Meta/properties/serverTime/type",
                                    keyword: "type",
                                    params: { type: "string" },
                                    message: "must be string",
                                  },
                                ];
                                return false;
                              }
                            }
                          }
                          var valid2 = _errs9 === errors;
                        } else {
                          var valid2 = true;
                        }
                        if (valid2) {
                          if (data1.apiVersion !== undefined) {
                            const _errs11 = errors;
                            if (typeof data1.apiVersion !== "string") {
                              validate101.errors = [
                                {
                                  instancePath:
                                    instancePath + "/meta/apiVersion",
                                  schemaPath:
                                    "#/components/schemas/Meta/properties/apiVersion/type",
                                  keyword: "type",
                                  params: { type: "string" },
                                  message: "must be string",
                                },
                              ];
                              return false;
                            }
                            var valid2 = _errs11 === errors;
                          } else {
                            var valid2 = true;
                          }
                        }
                      }
                    }
                  }
                } else {
                  validate101.errors = [
                    {
                      instancePath: instancePath + "/meta",
                      schemaPath: "#/components/schemas/Meta/type",
                      keyword: "type",
                      params: { type: "object" },
                      message: "must be object",
                    },
                  ];
                  return false;
                }
              }
              var valid0 = _errs3 === errors;
            } else {
              var valid0 = true;
            }
          }
        }
      }
    } else {
      validate101.errors = [
        {
          instancePath,
          schemaPath: "#/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        },
      ];
      return false;
    }
  }
  validate101.errors = vErrors;
  return errors === 0;
}
validate101.evaluated = {
  props: true,
  dynamicProps: false,
  dynamicItems: false,
};
exports.BootstrapEnvelope = validate104;
const schema121 = {
  type: "object",
  additionalProperties: false,
  properties: {
    data: { $ref: "#/components/schemas/BootstrapData" },
    meta: { $ref: "#/components/schemas/Meta" },
  },
  required: ["data", "meta"],
};
const schema122 = {
  type: "object",
  additionalProperties: false,
  properties: {
    csrfToken: {
      type: "string",
      description: "رمز حماية ضد تزوير الطلبات، ليس رمز جلسة دخول.",
      minLength: 32,
    },
    csrfHeaderName: { type: "string", enum: ["X-CSRF-Token"] },
    capabilities: { $ref: "#/components/schemas/Capabilities" },
    hasActiveGuestSession: { type: "boolean" },
  },
  required: [
    "csrfToken",
    "csrfHeaderName",
    "capabilities",
    "hasActiveGuestSession",
  ],
};
const schema123 = {
  type: "object",
  additionalProperties: false,
  properties: {
    notationProfile: { type: "string", enum: ["ar-mashriq-school-v1"] },
    subject: { type: "string", enum: ["algebra"] },
    variable: { type: "string", enum: ["س"] },
    mathModes: {
      type: "array",
      items: { type: "string", enum: ["linear_one_variable"] },
    },
    supportsTrigonometry: { type: "boolean", default: false },
    supportsHandwriting: { type: "boolean", default: false },
    supportsFractions: {
      type: "boolean",
      description: "تفعيل الكسور يخضع لنجاح اختبارات العرض.",
      default: false,
    },
    supportsTeacherRealData: { type: "boolean", default: false },
    supportedMathStatuses: {
      type: "array",
      items: { $ref: "#/components/schemas/MathStatus" },
    },
  },
  required: [
    "notationProfile",
    "subject",
    "variable",
    "mathModes",
    "supportsTrigonometry",
    "supportsHandwriting",
    "supportsFractions",
    "supportsTeacherRealData",
    "supportedMathStatuses",
  ],
};
function validate106(
  data,
  {
    instancePath = "",
    parentData,
    parentDataProperty,
    rootData = data,
    dynamicAnchors = {},
  } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate106.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (errors === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (
        (data.notationProfile === undefined &&
          (missing0 = "notationProfile")) ||
        (data.subject === undefined && (missing0 = "subject")) ||
        (data.variable === undefined && (missing0 = "variable")) ||
        (data.mathModes === undefined && (missing0 = "mathModes")) ||
        (data.supportsTrigonometry === undefined &&
          (missing0 = "supportsTrigonometry")) ||
        (data.supportsHandwriting === undefined &&
          (missing0 = "supportsHandwriting")) ||
        (data.supportsFractions === undefined &&
          (missing0 = "supportsFractions")) ||
        (data.supportsTeacherRealData === undefined &&
          (missing0 = "supportsTeacherRealData")) ||
        (data.supportedMathStatuses === undefined &&
          (missing0 = "supportedMathStatuses"))
      ) {
        validate106.errors = [
          {
            instancePath,
            schemaPath: "#/required",
            keyword: "required",
            params: { missingProperty: missing0 },
            message: "must have required property '" + missing0 + "'",
          },
        ];
        return false;
      } else {
        const _errs1 = errors;
        for (const key0 in data) {
          if (!func1.call(schema123.properties, key0)) {
            validate106.errors = [
              {
                instancePath,
                schemaPath: "#/additionalProperties",
                keyword: "additionalProperties",
                params: { additionalProperty: key0 },
                message: "must NOT have additional properties",
              },
            ];
            return false;
            break;
          }
        }
        if (_errs1 === errors) {
          if (data.notationProfile !== undefined) {
            let data0 = data.notationProfile;
            const _errs2 = errors;
            if (typeof data0 !== "string") {
              validate106.errors = [
                {
                  instancePath: instancePath + "/notationProfile",
                  schemaPath: "#/properties/notationProfile/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                },
              ];
              return false;
            }
            if (!(data0 === "ar-mashriq-school-v1")) {
              validate106.errors = [
                {
                  instancePath: instancePath + "/notationProfile",
                  schemaPath: "#/properties/notationProfile/enum",
                  keyword: "enum",
                  params: {
                    allowedValues: schema123.properties.notationProfile.enum,
                  },
                  message: "must be equal to one of the allowed values",
                },
              ];
              return false;
            }
            var valid0 = _errs2 === errors;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.subject !== undefined) {
              let data1 = data.subject;
              const _errs4 = errors;
              if (typeof data1 !== "string") {
                validate106.errors = [
                  {
                    instancePath: instancePath + "/subject",
                    schemaPath: "#/properties/subject/type",
                    keyword: "type",
                    params: { type: "string" },
                    message: "must be string",
                  },
                ];
                return false;
              }
              if (!(data1 === "algebra")) {
                validate106.errors = [
                  {
                    instancePath: instancePath + "/subject",
                    schemaPath: "#/properties/subject/enum",
                    keyword: "enum",
                    params: {
                      allowedValues: schema123.properties.subject.enum,
                    },
                    message: "must be equal to one of the allowed values",
                  },
                ];
                return false;
              }
              var valid0 = _errs4 === errors;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.variable !== undefined) {
                let data2 = data.variable;
                const _errs6 = errors;
                if (typeof data2 !== "string") {
                  validate106.errors = [
                    {
                      instancePath: instancePath + "/variable",
                      schemaPath: "#/properties/variable/type",
                      keyword: "type",
                      params: { type: "string" },
                      message: "must be string",
                    },
                  ];
                  return false;
                }
                if (!(data2 === "س")) {
                  validate106.errors = [
                    {
                      instancePath: instancePath + "/variable",
                      schemaPath: "#/properties/variable/enum",
                      keyword: "enum",
                      params: {
                        allowedValues: schema123.properties.variable.enum,
                      },
                      message: "must be equal to one of the allowed values",
                    },
                  ];
                  return false;
                }
                var valid0 = _errs6 === errors;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.mathModes !== undefined) {
                  let data3 = data.mathModes;
                  const _errs8 = errors;
                  if (errors === _errs8) {
                    if (Array.isArray(data3)) {
                      var valid1 = true;
                      const len0 = data3.length;
                      for (let i0 = 0; i0 < len0; i0++) {
                        let data4 = data3[i0];
                        const _errs10 = errors;
                        if (typeof data4 !== "string") {
                          validate106.errors = [
                            {
                              instancePath: instancePath + "/mathModes/" + i0,
                              schemaPath: "#/properties/mathModes/items/type",
                              keyword: "type",
                              params: { type: "string" },
                              message: "must be string",
                            },
                          ];
                          return false;
                        }
                        if (!(data4 === "linear_one_variable")) {
                          validate106.errors = [
                            {
                              instancePath: instancePath + "/mathModes/" + i0,
                              schemaPath: "#/properties/mathModes/items/enum",
                              keyword: "enum",
                              params: {
                                allowedValues:
                                  schema123.properties.mathModes.items.enum,
                              },
                              message:
                                "must be equal to one of the allowed values",
                            },
                          ];
                          return false;
                        }
                        var valid1 = _errs10 === errors;
                        if (!valid1) {
                          break;
                        }
                      }
                    } else {
                      validate106.errors = [
                        {
                          instancePath: instancePath + "/mathModes",
                          schemaPath: "#/properties/mathModes/type",
                          keyword: "type",
                          params: { type: "array" },
                          message: "must be array",
                        },
                      ];
                      return false;
                    }
                  }
                  var valid0 = _errs8 === errors;
                } else {
                  var valid0 = true;
                }
                if (valid0) {
                  if (data.supportsTrigonometry !== undefined) {
                    const _errs12 = errors;
                    if (typeof data.supportsTrigonometry !== "boolean") {
                      validate106.errors = [
                        {
                          instancePath: instancePath + "/supportsTrigonometry",
                          schemaPath: "#/properties/supportsTrigonometry/type",
                          keyword: "type",
                          params: { type: "boolean" },
                          message: "must be boolean",
                        },
                      ];
                      return false;
                    }
                    var valid0 = _errs12 === errors;
                  } else {
                    var valid0 = true;
                  }
                  if (valid0) {
                    if (data.supportsHandwriting !== undefined) {
                      const _errs14 = errors;
                      if (typeof data.supportsHandwriting !== "boolean") {
                        validate106.errors = [
                          {
                            instancePath: instancePath + "/supportsHandwriting",
                            schemaPath: "#/properties/supportsHandwriting/type",
                            keyword: "type",
                            params: { type: "boolean" },
                            message: "must be boolean",
                          },
                        ];
                        return false;
                      }
                      var valid0 = _errs14 === errors;
                    } else {
                      var valid0 = true;
                    }
                    if (valid0) {
                      if (data.supportsFractions !== undefined) {
                        const _errs16 = errors;
                        if (typeof data.supportsFractions !== "boolean") {
                          validate106.errors = [
                            {
                              instancePath: instancePath + "/supportsFractions",
                              schemaPath: "#/properties/supportsFractions/type",
                              keyword: "type",
                              params: { type: "boolean" },
                              message: "must be boolean",
                            },
                          ];
                          return false;
                        }
                        var valid0 = _errs16 === errors;
                      } else {
                        var valid0 = true;
                      }
                      if (valid0) {
                        if (data.supportsTeacherRealData !== undefined) {
                          const _errs18 = errors;
                          if (
                            typeof data.supportsTeacherRealData !== "boolean"
                          ) {
                            validate106.errors = [
                              {
                                instancePath:
                                  instancePath + "/supportsTeacherRealData",
                                schemaPath:
                                  "#/properties/supportsTeacherRealData/type",
                                keyword: "type",
                                params: { type: "boolean" },
                                message: "must be boolean",
                              },
                            ];
                            return false;
                          }
                          var valid0 = _errs18 === errors;
                        } else {
                          var valid0 = true;
                        }
                        if (valid0) {
                          if (data.supportedMathStatuses !== undefined) {
                            let data9 = data.supportedMathStatuses;
                            const _errs20 = errors;
                            if (errors === _errs20) {
                              if (Array.isArray(data9)) {
                                var valid2 = true;
                                const len1 = data9.length;
                                for (let i1 = 0; i1 < len1; i1++) {
                                  let data10 = data9[i1];
                                  const _errs22 = errors;
                                  if (typeof data10 !== "string") {
                                    validate106.errors = [
                                      {
                                        instancePath:
                                          instancePath +
                                          "/supportedMathStatuses/" +
                                          i1,
                                        schemaPath:
                                          "#/components/schemas/MathStatus/type",
                                        keyword: "type",
                                        params: { type: "string" },
                                        message: "must be string",
                                      },
                                    ];
                                    return false;
                                  }
                                  if (
                                    !(
                                      data10 === "verified_valid" ||
                                      data10 === "verified_invalid" ||
                                      data10 === "syntax_error" ||
                                      data10 === "unsupported" ||
                                      data10 === "inconclusive" ||
                                      data10 === "service_error"
                                    )
                                  ) {
                                    validate106.errors = [
                                      {
                                        instancePath:
                                          instancePath +
                                          "/supportedMathStatuses/" +
                                          i1,
                                        schemaPath:
                                          "#/components/schemas/MathStatus/enum",
                                        keyword: "enum",
                                        params: {
                                          allowedValues: schema46.enum,
                                        },
                                        message:
                                          "must be equal to one of the allowed values",
                                      },
                                    ];
                                    return false;
                                  }
                                  var valid2 = _errs22 === errors;
                                  if (!valid2) {
                                    break;
                                  }
                                }
                              } else {
                                validate106.errors = [
                                  {
                                    instancePath:
                                      instancePath + "/supportedMathStatuses",
                                    schemaPath:
                                      "#/properties/supportedMathStatuses/type",
                                    keyword: "type",
                                    params: { type: "array" },
                                    message: "must be array",
                                  },
                                ];
                                return false;
                              }
                            }
                            var valid0 = _errs20 === errors;
                          } else {
                            var valid0 = true;
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    } else {
      validate106.errors = [
        {
          instancePath,
          schemaPath: "#/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        },
      ];
      return false;
    }
  }
  validate106.errors = vErrors;
  return errors === 0;
}
validate106.evaluated = {
  props: true,
  dynamicProps: false,
  dynamicItems: false,
};
function validate105(
  data,
  {
    instancePath = "",
    parentData,
    parentDataProperty,
    rootData = data,
    dynamicAnchors = {},
  } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate105.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (errors === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (
        (data.csrfToken === undefined && (missing0 = "csrfToken")) ||
        (data.csrfHeaderName === undefined && (missing0 = "csrfHeaderName")) ||
        (data.capabilities === undefined && (missing0 = "capabilities")) ||
        (data.hasActiveGuestSession === undefined &&
          (missing0 = "hasActiveGuestSession"))
      ) {
        validate105.errors = [
          {
            instancePath,
            schemaPath: "#/required",
            keyword: "required",
            params: { missingProperty: missing0 },
            message: "must have required property '" + missing0 + "'",
          },
        ];
        return false;
      } else {
        const _errs1 = errors;
        for (const key0 in data) {
          if (
            !(
              key0 === "csrfToken" ||
              key0 === "csrfHeaderName" ||
              key0 === "capabilities" ||
              key0 === "hasActiveGuestSession"
            )
          ) {
            validate105.errors = [
              {
                instancePath,
                schemaPath: "#/additionalProperties",
                keyword: "additionalProperties",
                params: { additionalProperty: key0 },
                message: "must NOT have additional properties",
              },
            ];
            return false;
            break;
          }
        }
        if (_errs1 === errors) {
          if (data.csrfToken !== undefined) {
            let data0 = data.csrfToken;
            const _errs2 = errors;
            if (errors === _errs2) {
              if (typeof data0 === "string") {
                if (func2(data0) < 32) {
                  validate105.errors = [
                    {
                      instancePath: instancePath + "/csrfToken",
                      schemaPath: "#/properties/csrfToken/minLength",
                      keyword: "minLength",
                      params: { limit: 32 },
                      message: "must NOT have fewer than 32 characters",
                    },
                  ];
                  return false;
                }
              } else {
                validate105.errors = [
                  {
                    instancePath: instancePath + "/csrfToken",
                    schemaPath: "#/properties/csrfToken/type",
                    keyword: "type",
                    params: { type: "string" },
                    message: "must be string",
                  },
                ];
                return false;
              }
            }
            var valid0 = _errs2 === errors;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.csrfHeaderName !== undefined) {
              let data1 = data.csrfHeaderName;
              const _errs4 = errors;
              if (typeof data1 !== "string") {
                validate105.errors = [
                  {
                    instancePath: instancePath + "/csrfHeaderName",
                    schemaPath: "#/properties/csrfHeaderName/type",
                    keyword: "type",
                    params: { type: "string" },
                    message: "must be string",
                  },
                ];
                return false;
              }
              if (!(data1 === "X-CSRF-Token")) {
                validate105.errors = [
                  {
                    instancePath: instancePath + "/csrfHeaderName",
                    schemaPath: "#/properties/csrfHeaderName/enum",
                    keyword: "enum",
                    params: {
                      allowedValues: schema122.properties.csrfHeaderName.enum,
                    },
                    message: "must be equal to one of the allowed values",
                  },
                ];
                return false;
              }
              var valid0 = _errs4 === errors;
            } else {
              var valid0 = true;
            }
            if (valid0) {
              if (data.capabilities !== undefined) {
                const _errs6 = errors;
                if (
                  !validate106(data.capabilities, {
                    instancePath: instancePath + "/capabilities",
                    parentData: data,
                    parentDataProperty: "capabilities",
                    rootData,
                    dynamicAnchors,
                  })
                ) {
                  vErrors =
                    vErrors === null
                      ? validate106.errors
                      : vErrors.concat(validate106.errors);
                  errors = vErrors.length;
                }
                var valid0 = _errs6 === errors;
              } else {
                var valid0 = true;
              }
              if (valid0) {
                if (data.hasActiveGuestSession !== undefined) {
                  const _errs7 = errors;
                  if (typeof data.hasActiveGuestSession !== "boolean") {
                    validate105.errors = [
                      {
                        instancePath: instancePath + "/hasActiveGuestSession",
                        schemaPath: "#/properties/hasActiveGuestSession/type",
                        keyword: "type",
                        params: { type: "boolean" },
                        message: "must be boolean",
                      },
                    ];
                    return false;
                  }
                  var valid0 = _errs7 === errors;
                } else {
                  var valid0 = true;
                }
              }
            }
          }
        }
      }
    } else {
      validate105.errors = [
        {
          instancePath,
          schemaPath: "#/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        },
      ];
      return false;
    }
  }
  validate105.errors = vErrors;
  return errors === 0;
}
validate105.evaluated = {
  props: true,
  dynamicProps: false,
  dynamicItems: false,
};
function validate104(
  data,
  {
    instancePath = "",
    parentData,
    parentDataProperty,
    rootData = data,
    dynamicAnchors = {},
  } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate104.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (errors === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
      let missing0;
      if (
        (data.data === undefined && (missing0 = "data")) ||
        (data.meta === undefined && (missing0 = "meta"))
      ) {
        validate104.errors = [
          {
            instancePath,
            schemaPath: "#/required",
            keyword: "required",
            params: { missingProperty: missing0 },
            message: "must have required property '" + missing0 + "'",
          },
        ];
        return false;
      } else {
        const _errs1 = errors;
        for (const key0 in data) {
          if (!(key0 === "data" || key0 === "meta")) {
            validate104.errors = [
              {
                instancePath,
                schemaPath: "#/additionalProperties",
                keyword: "additionalProperties",
                params: { additionalProperty: key0 },
                message: "must NOT have additional properties",
              },
            ];
            return false;
            break;
          }
        }
        if (_errs1 === errors) {
          if (data.data !== undefined) {
            const _errs2 = errors;
            if (
              !validate105(data.data, {
                instancePath: instancePath + "/data",
                parentData: data,
                parentDataProperty: "data",
                rootData,
                dynamicAnchors,
              })
            ) {
              vErrors =
                vErrors === null
                  ? validate105.errors
                  : vErrors.concat(validate105.errors);
              errors = vErrors.length;
            }
            var valid0 = _errs2 === errors;
          } else {
            var valid0 = true;
          }
          if (valid0) {
            if (data.meta !== undefined) {
              let data1 = data.meta;
              const _errs3 = errors;
              const _errs4 = errors;
              if (errors === _errs4) {
                if (
                  data1 &&
                  typeof data1 == "object" &&
                  !Array.isArray(data1)
                ) {
                  let missing1;
                  if (
                    (data1.requestId === undefined &&
                      (missing1 = "requestId")) ||
                    (data1.serverTime === undefined &&
                      (missing1 = "serverTime")) ||
                    (data1.apiVersion === undefined &&
                      (missing1 = "apiVersion"))
                  ) {
                    validate104.errors = [
                      {
                        instancePath: instancePath + "/meta",
                        schemaPath: "#/components/schemas/Meta/required",
                        keyword: "required",
                        params: { missingProperty: missing1 },
                        message:
                          "must have required property '" + missing1 + "'",
                      },
                    ];
                    return false;
                  } else {
                    const _errs6 = errors;
                    for (const key1 in data1) {
                      if (
                        !(
                          key1 === "requestId" ||
                          key1 === "serverTime" ||
                          key1 === "apiVersion"
                        )
                      ) {
                        validate104.errors = [
                          {
                            instancePath: instancePath + "/meta",
                            schemaPath:
                              "#/components/schemas/Meta/additionalProperties",
                            keyword: "additionalProperties",
                            params: { additionalProperty: key1 },
                            message: "must NOT have additional properties",
                          },
                        ];
                        return false;
                        break;
                      }
                    }
                    if (_errs6 === errors) {
                      if (data1.requestId !== undefined) {
                        let data2 = data1.requestId;
                        const _errs7 = errors;
                        if (errors === _errs7) {
                          if (errors === _errs7) {
                            if (typeof data2 === "string") {
                              if (!formats4.test(data2)) {
                                validate104.errors = [
                                  {
                                    instancePath:
                                      instancePath + "/meta/requestId",
                                    schemaPath:
                                      "#/components/schemas/Meta/properties/requestId/format",
                                    keyword: "format",
                                    params: { format: "uuid" },
                                    message:
                                      'must match format "' + "uuid" + '"',
                                  },
                                ];
                                return false;
                              }
                            } else {
                              validate104.errors = [
                                {
                                  instancePath:
                                    instancePath + "/meta/requestId",
                                  schemaPath:
                                    "#/components/schemas/Meta/properties/requestId/type",
                                  keyword: "type",
                                  params: { type: "string" },
                                  message: "must be string",
                                },
                              ];
                              return false;
                            }
                          }
                        }
                        var valid2 = _errs7 === errors;
                      } else {
                        var valid2 = true;
                      }
                      if (valid2) {
                        if (data1.serverTime !== undefined) {
                          let data3 = data1.serverTime;
                          const _errs9 = errors;
                          if (errors === _errs9) {
                            if (errors === _errs9) {
                              if (typeof data3 === "string") {
                                if (!formats6.validate(data3)) {
                                  validate104.errors = [
                                    {
                                      instancePath:
                                        instancePath + "/meta/serverTime",
                                      schemaPath:
                                        "#/components/schemas/Meta/properties/serverTime/format",
                                      keyword: "format",
                                      params: { format: "date-time" },
                                      message:
                                        'must match format "' +
                                        "date-time" +
                                        '"',
                                    },
                                  ];
                                  return false;
                                }
                              } else {
                                validate104.errors = [
                                  {
                                    instancePath:
                                      instancePath + "/meta/serverTime",
                                    schemaPath:
                                      "#/components/schemas/Meta/properties/serverTime/type",
                                    keyword: "type",
                                    params: { type: "string" },
                                    message: "must be string",
                                  },
                                ];
                                return false;
                              }
                            }
                          }
                          var valid2 = _errs9 === errors;
                        } else {
                          var valid2 = true;
                        }
                        if (valid2) {
                          if (data1.apiVersion !== undefined) {
                            const _errs11 = errors;
                            if (typeof data1.apiVersion !== "string") {
                              validate104.errors = [
                                {
                                  instancePath:
                                    instancePath + "/meta/apiVersion",
                                  schemaPath:
                                    "#/components/schemas/Meta/properties/apiVersion/type",
                                  keyword: "type",
                                  params: { type: "string" },
                                  message: "must be string",
                                },
                              ];
                              return false;
                            }
                            var valid2 = _errs11 === errors;
                          } else {
                            var valid2 = true;
                          }
                        }
                      }
                    }
                  }
                } else {
                  validate104.errors = [
                    {
                      instancePath: instancePath + "/meta",
                      schemaPath: "#/components/schemas/Meta/type",
                      keyword: "type",
                      params: { type: "object" },
                      message: "must be object",
                    },
                  ];
                  return false;
                }
              }
              var valid0 = _errs3 === errors;
            } else {
              var valid0 = true;
            }
          }
        }
      }
    } else {
      validate104.errors = [
        {
          instancePath,
          schemaPath: "#/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        },
      ];
      return false;
    }
  }
  validate104.errors = vErrors;
  return errors === 0;
}
validate104.evaluated = {
  props: true,
  dynamicProps: false,
  dynamicItems: false,
};
