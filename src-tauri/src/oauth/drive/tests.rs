use super::*;

fn fixture_folder() -> Folder {
    Folder {
        id: "folder_123".into(),
        profile: "prof_qa_fixture_12345678".into(),
    }
}
fn folder_metadata(f: &Folder) -> Value {
    json!({
        "id":f.id,"name":"Study Director","mimeType":FOLDER,"ownedByMe":true,"shared":false,"trashed":false,
        "appProperties":{"studyDirectorFolder":"true","studyDirectorProfile":f.profile},
        "capabilities":{"canAddChildren":true}
    })
}
fn record(f: &Folder, kind: &str) -> Value {
    let id = if kind == "object" {
        format!("obj_{}", "a".repeat(32))
    } else {
        format!("cp_{}", "b".repeat(32))
    };
    let digest = "a".repeat(64);
    json!({"id":format!("remote_{kind}"),"name":logical_name(kind,&id).unwrap(),"mimeType":BINARY,"parents":[f.id],
        "ownedByMe":true,"shared":false,"trashed":false,"size":"100","version":"1","sha256Checksum":digest,
        "capabilities":{"canDownload":true},"appProperties":{"studyDirectorRepository":"true","studyDirectorRepositoryVersion":"1",
        "studyDirectorRepositoryKind":kind,"studyDirectorRepositoryId":id,"studyDirectorSecurity":"1","studyDirectorSha256":digest}})
}
fn request(method: &str, url: &str, headers: &[(&str, &str)]) -> DriveRequest {
    DriveRequest {
        url: url.into(),
        method: method.into(),
        headers: headers
            .iter()
            .map(|(k, v)| (k.to_string(), v.to_string()))
            .collect(),
        body: String::new(),
    }
}
fn classify_request(req: &DriveRequest, gate: &Gate, body: &[u8]) -> DriveResult<OperationKind> {
    classify(req, &checked_url(&req.url)?, gate, body)
}
fn list_url(query: &str, fields: &str) -> String {
    let mut url = Url::parse(&format!("{ORIGIN}{FILES}")).unwrap();
    url.query_pairs_mut()
        .append_pair("q", query)
        .append_pair("spaces", "drive")
        .append_pair("pageSize", "10")
        .append_pair("fields", fields);
    url.to_string()
}
fn admitted() -> Gate {
    let mut gate = Gate::for_generation(2);
    gate.observe_folder(&json!({"files":[folder_metadata(&fixture_folder())]}))
        .unwrap();
    gate.admitted = true;
    gate
}

#[test]
fn discovery_is_exact_and_never_creates_a_folder() {
    let mut gate = Gate::for_generation(2);
    let fields = format!("nextPageToken,incompleteSearch,files({FOLDER_FIELDS})");
    let req = request("GET", &list_url(&discovery_query(), &fields), &[]);
    assert!(matches!(
        classify_request(&req, &gate, &[]),
        Ok(OperationKind::List(Listing::Folders))
    ));
    for q in [
        "trashed=false",
        "name='Study Director' and trashed=false",
        "'foreign' in parents and trashed=false",
    ] {
        assert!(classify_request(&request("GET", &list_url(q, &fields), &[]), &gate, &[]).is_err());
    }
    for bad in [
        json!({}),
        json!({"files":[]}),
        json!({"files":[folder_metadata(&fixture_folder())],"incompleteSearch":true}),
        json!({"files":[folder_metadata(&fixture_folder())],"nextPageToken":"next"}),
        json!({"files":[folder_metadata(&fixture_folder()),folder_metadata(&fixture_folder())]}),
    ] {
        assert!(gate.observe_folder(&bad).is_err());
        assert!(gate.candidate.is_none());
    }
    let create = request(
        "POST",
        &format!("{ORIGIN}{FILES}?fields=id"),
        &[("content-type", "application/json")],
    );
    let body = json!({"name":"Study Director","mimeType":FOLDER,"appProperties":{"studyDirectorFolder":"true","studyDirectorProfile":fixture_folder().profile}});
    assert!(classify_request(&create, &gate, body.to_string().as_bytes()).is_err());
    let gate = admitted();
    assert!(classify_request(&create, &gate, body.to_string().as_bytes()).is_err());
}

#[test]
fn only_private_marked_folder_and_verified_repository_media_are_admissible() {
    let f = fixture_folder();
    let mut gate = Gate::for_generation(2);
    let mut shared = folder_metadata(&f);
    shared["shared"] = json!(true);
    assert!(gate.observe_folder(&json!({"files":[shared]})).is_err());
    gate.observe_folder(&json!({"files":[folder_metadata(&f)]}))
        .unwrap();
    for kind in ["commit", "checkpoint", "object"] {
        let raw = record(&f, kind);
        let m = media(&raw, &f.id).unwrap();
        gate.witnesses.insert(kind.into(), m);
        let mut corrupt = raw.clone();
        corrupt["sha256Checksum"] = json!("b".repeat(64));
        assert!(media(&corrupt, &f.id).is_none());
        let mut foreign = raw.clone();
        foreign["parents"] = json!(["other"]);
        assert!(media(&foreign, &f.id).is_none());
        let mut unowned = raw;
        unowned["ownedByMe"] = json!(false);
        assert!(media(&unowned, &f.id).is_none());
    }
    assert!(gate.proved());
    gate.witnesses.get_mut("checkpoint").unwrap().id = "other".into();
    assert!(!gate.proved());
    gate.admitted = true;
    let mut different = f;
    different.id = "successor".into();
    assert!(gate
        .observe_folder(&json!({"files":[folder_metadata(&different)]}))
        .is_err());
    assert!(gate.write_folder().is_err());
    assert!(gate
        .observe_folder(&json!({"files":[folder_metadata(&different)]}))
        .is_err());
}

#[test]
fn foreign_origin_paths_queries_headers_and_duplicate_parameters_are_rejected() {
    let gate = admitted();
    for url in [
        "https://evil.invalid/drive/v3/files",
        "https://www.googleapis.com.evil.invalid/drive/v3/files",
        "https://user@www.googleapis.com/drive/v3/files",
        "https://www.googleapis.com:123/drive/v3/files",
        "http://www.googleapis.com/drive/v3/files",
        "https://www.googleapis.com/drive/v3/files?x=1#x",
        "https://www.googleapis.com/drive/v3/permissions",
        "https://www.googleapis.com/drive/v3/files/foreign%2Fpath?alt=media",
        "https://www.googleapis.com/drive/v3/files/foreign?alt=media&alt=media",
        "https://www.googleapis.com/drive/v3/files/foreign?alt=media&access_token=fixture",
    ] {
        assert!(
            classify_request(&request("GET", url, &[]), &gate, &[]).is_err(),
            "{url}"
        );
    }
    let url = format!("{ORIGIN}{FILES}/item?alt=media");
    for (key, val) in [
        ("authorization", "Bearer fixture"),
        ("cookie", "fixture"),
        ("range", "bytes=0-1048576"),
        ("range", "bytes=2-1"),
        ("range", "bytes=0-1,3-4"),
    ] {
        assert!(classify_request(&request("GET", &url, &[(key, val)]), &gate, &[]).is_err());
    }
    assert!(matches!(
        classify_request(
            &request("GET", &url, &[("range", "bytes=0-1048575")]),
            &gate,
            &[]
        ),
        Ok(OperationKind::Media(_, Some((0, 1048575))))
    ));
    let query = format!(
        "'foreign' in parents and {} and {} and trashed=false",
        prop("studyDirectorRepository", "true"),
        prop("studyDirectorRepositoryKind", "object")
    );
    assert!(classify_request(
        &request(
            "GET",
            &list_url(&query, &format!("nextPageToken,files({FILE_FIELDS})")),
            &[]
        ),
        &gate,
        &[]
    )
    .is_err());
}

#[test]
fn only_admitted_folder_mutations_and_owned_resumable_handles_are_allowed() {
    let mut gate = admitted();
    let f = fixture_folder();
    let rename = request(
        "PATCH",
        &format!("{ORIGIN}{FILES}/{}?fields=id,name", f.id),
        &[("content-type", "application/json")],
    );
    assert!(matches!(
        classify_request(&rename, &gate, br#"{"name":"Renamed"}"#),
        Ok(OperationKind::Rename)
    ));
    assert!(classify_request(
        &rename,
        &gate,
        br#"{"name":"Renamed","parents":["foreign"]}"#
    )
    .is_err());
    let trash = request(
        "PATCH",
        &format!("{ORIGIN}{FILES}/{}?fields=id", f.id),
        &[("content-type", "application/json")],
    );
    assert!(matches!(
        classify_request(&trash, &gate, br#"{"trashed":true}"#),
        Ok(OperationKind::Trash)
    ));
    assert!(classify_request(
        &request("DELETE", &format!("{ORIGIN}{FILES}/{}", f.id), &[]),
        &gate,
        &[]
    )
    .is_err());
    let create = request(
        "POST",
        &format!("{ORIGIN}{FILES}?fields=id"),
        &[("content-type", "application/json")],
    );
    let marker = json!({"name":"Study Director (deleted)","mimeType":FOLDER,"appProperties":{"studyDirectorDeletedProfile":f.profile}});
    assert!(matches!(
        classify_request(&create, &gate, marker.to_string().as_bytes()),
        Ok(OperationKind::Create)
    ));
    let mut bad = marker;
    bad["appProperties"]["studyDirectorDeletedProfile"] = json!("prof_qa_fixture_aaaaaaaa");
    assert!(classify_request(&create, &gate, bad.to_string().as_bytes()).is_err());
    let location = format!("{ORIGIN}{UPLOAD}?uploadType=resumable&upload_id=opaque");
    let put = request(
        "PUT",
        &location,
        &[("content-range", "bytes 0-3/4"), ("content-type", BINARY)],
    );
    assert!(classify_request(&put, &gate, b"data").is_err());
    gate.uploads.insert(
        location.clone(),
        UploadSession {
            url: Url::parse(&location).unwrap(),
            total: 4,
            issued: Instant::now(),
        },
    );
    assert!(matches!(
        classify_request(&put, &gate, b"data"),
        Ok(OperationKind::Upload(_))
    ));
    assert!(classify_request(&put, &gate, b"wrong").is_err());
    let status = request("PUT", &location, &[("content-range", "bytes */4")]);
    assert!(classify_request(&status, &gate, &[]).is_ok());
    gate.admitted = false;
    assert!(classify_request(&put, &gate, b"data").is_err());
    assert!(classify_request(&rename, &gate, br#"{"name":"Renamed"}"#).is_err());
}

#[test]
fn deletion_status_is_fail_closed_and_error_payload_never_echoes_credentials() {
    let f = fixture_folder();
    assert!(!deletion_present(&json!({"files":[]}), &f.profile).unwrap());
    let marker = json!({"id":"marker","mimeType":FOLDER,"ownedByMe":true,"shared":false,"trashed":false,
        "appProperties":{"studyDirectorDeletedProfile":f.profile}});
    assert!(deletion_present(&json!({"files":[marker.clone()]}), &f.profile).unwrap());
    for bad in [
        json!({}),
        json!({"files":[],"incompleteSearch":null}),
        json!({"files":[],"nextPageToken":"next"}),
        json!({"files":[marker.clone(),marker.clone()]}),
        json!({"files":[marker],"incompleteSearch":true}),
    ] {
        assert!(deletion_present(&bad, &f.profile).is_err());
    }
    let bytes=safe_error(br#"{"error":{"message":"Bearer secret-token","errors":[{"reason":"rateLimitExceeded"},{"reason":"secret-token"}]}}"#,403);
    let message = String::from_utf8(bytes).unwrap();
    assert!(message.contains("rateLimitExceeded"));
    assert!(!message.contains("secret-token"));
}
