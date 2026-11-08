#Requires -Version 7.0
[CmdletBinding()]
param(
    [ValidateSet('Prepare', 'Trust', 'Status', 'RemoveTrust')]
    [string]$Action = 'Status'
)

$ErrorActionPreference = 'Stop'
if (-not $IsWindows) { throw 'This development certificate helper requires Windows and PowerShell 7.' }
$workspace = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$tlsDirectory = Join-Path $workspace '.local/v22-tls'
$certificatePath = Join-Path $tlsDirectory 'cert.pem'
$derPath = Join-Path $tlsDirectory 'cert.cer'
$privateKeyPath = Join-Path $tlsDirectory 'key.pem'
$metadataPath = Join-Path $tlsDirectory 'managed-certificate.json'
$evidencePath = Join-Path $workspace 'qa-reports/V2.2-HTTPS-SETUP.json'
$opensslPath = 'C:/Program Files/Git/usr/bin/openssl.exe'
if (-not (Test-Path -LiteralPath $opensslPath -PathType Leaf)) {
    $opensslCommand = Get-Command openssl -ErrorAction SilentlyContinue
    if (-not $opensslCommand) { throw 'OpenSSL is required; no software is downloaded by this helper.' }
    $opensslPath = $opensslCommand.Source
}

function Invoke-OpenSsl([string[]]$Arguments) {
    $output = & $opensslPath @Arguments 2>&1
    if ($LASTEXITCODE -ne 0) { throw 'OpenSSL certificate operation failed. No certificate store was changed.' }
    return ($output -join "`n")
}

function Restrict-TlsDirectory {
    $currentSid = [Security.Principal.WindowsIdentity]::GetCurrent().User
    $systemSid = [Security.Principal.SecurityIdentifier]::new('S-1-5-18')
    $acl = [Security.AccessControl.DirectorySecurity]::new()
    $acl.SetOwner($currentSid)
    $acl.SetAccessRuleProtection($true, $false)
    $inheritance = [Security.AccessControl.InheritanceFlags]::ContainerInherit -bor [Security.AccessControl.InheritanceFlags]::ObjectInherit
    foreach ($sid in @($currentSid, $systemSid)) {
        $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new(
            $sid, [Security.AccessControl.FileSystemRights]::FullControl, $inheritance,
            [Security.AccessControl.PropagationFlags]::None, [Security.AccessControl.AccessControlType]::Allow
        ))
    }
    Set-Acl -LiteralPath $tlsDirectory -AclObject $acl
}

function Read-ManagedCertificate {
    foreach ($file in @($certificatePath, $derPath, $privateKeyPath, $metadataPath)) {
        if (-not (Test-Path -LiteralPath $file -PathType Leaf)) {
            throw 'Managed certificate files are absent or incomplete. Run Prepare for a new empty .local/v22-tls directory; existing files are never overwritten.'
        }
    }
    $managed = Get-Content -Raw -LiteralPath $metadataPath | ConvertFrom-Json
    $certificate = [Security.Cryptography.X509Certificates.X509Certificate2]::new([IO.File]::ReadAllBytes($derPath))
    if ($managed.kind -ne 'khotwa-v22-local-server-leaf-v1' -or $managed.thumbprint -ne $certificate.Thumbprint -or
        $managed.derSha256 -ne (Get-FileHash -LiteralPath $derPath -Algorithm SHA256).Hash) {
        throw 'Managed certificate identity does not match its metadata. No trust changes are allowed.'
    }
    $pemDer = Invoke-OpenSsl @('x509', '-in', $certificatePath, '-noout', '-fingerprint', '-sha256')
    if (($pemDer -replace '^.*=', '' -replace ':', '').Trim() -ne $managed.derSha256) {
        throw 'PEM and DER certificate identities differ.'
    }
    $constraintsRaw = $certificate.Extensions | Where-Object { $_.Oid.Value -eq '2.5.29.19' }
    $constraints = [Security.Cryptography.X509Certificates.X509BasicConstraintsExtension]::new($constraintsRaw, $constraintsRaw.Critical)
    $ekuRaw = $certificate.Extensions | Where-Object { $_.Oid.Value -eq '2.5.29.37' }
    $eku = [Security.Cryptography.X509Certificates.X509EnhancedKeyUsageExtension]::new($ekuRaw, $ekuRaw.Critical)
    $purposes = @($eku.EnhancedKeyUsages | ForEach-Object { $_.Value })
    $san = Invoke-OpenSsl @('x509', '-in', $certificatePath, '-noout', '-ext', 'subjectAltName')
    $names = @(($san -split "`n" | Select-Object -Skip 1) -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_ })
    if ($constraints.CertificateAuthority -or -not $constraints.Critical -or
        $purposes.Count -ne 1 -or $purposes[0] -ne '1.3.6.1.5.5.7.3.1' -or
        $names.Count -ne 2 -or 'DNS:localhost' -notin $names -or 'IP Address:127.0.0.1' -notin $names -or
        $certificate.Subject -ne $certificate.Issuer) {
        throw 'Only the exact self-signed localhost server leaf is eligible for development trust.'
    }
    if ($Action -in @('Prepare', 'Trust') -and ($certificate.NotBefore.ToUniversalTime() -gt [DateTime]::UtcNow -or $certificate.NotAfter.ToUniversalTime() -le [DateTime]::UtcNow)) {
        throw 'The managed certificate is not currently valid. It is not silently replaced.'
    }
    $certPublicKey = Invoke-OpenSsl @('x509', '-in', $certificatePath, '-pubkey', '-noout')
    $keyPublicKey = Invoke-OpenSsl @('pkey', '-in', $privateKeyPath, '-pubout')
    if ($certPublicKey.Trim() -ne $keyPublicKey.Trim()) { throw 'The private key does not match the certificate.' }
    $allowedSids = @([Security.Principal.WindowsIdentity]::GetCurrent().User.Value, 'S-1-5-18')
    foreach ($rule in (Get-Acl -LiteralPath $privateKeyPath).Access) {
        if ($rule.AccessControlType -eq 'Allow' -and $rule.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value -notin $allowedSids) {
            throw 'The managed private key grants access beyond the current user and SYSTEM.'
        }
    }
    return @{ Certificate = $certificate; Metadata = $managed }
}

function Invoke-ManagedTrustImport {
    # Standard native Windows import. Only the already-validated public leaf is
    # supplied; -user restricts the change to this user's Root store. No browser
    # flag, machine policy, certificate validation setting or broad CA is used.
    $certutilPath = Join-Path $env:SystemRoot 'System32/certutil.exe'
    $output = & $certutilPath -f -user -addstore Root $derPath 2>&1
    if ($LASTEXITCODE -ne 0) { throw 'Exact current-user certificate import failed; inspect native Windows consent if present.' }
}

function Remove-ManagedTrust($Certificate) {
    # Read-ManagedCertificate has verified the exact public-certificate identity.
    # A thumbprint selector prevents changes to any other trust anchor.
    $certutilPath = Join-Path $env:SystemRoot 'System32/certutil.exe'
    $output = & $certutilPath -user -delstore Root $Certificate.Thumbprint 2>&1
    if ($LASTEXITCODE -ne 0) { throw 'Exact managed certificate trust removal failed.' }
}

function Test-CurrentUserTrust($Certificate) {
    $store = [Security.Cryptography.X509Certificates.X509Store]::new('Root', 'CurrentUser')
    try {
        $store.Open([Security.Cryptography.X509Certificates.OpenFlags]::ReadOnly)
        $matches = @($store.Certificates.Find([Security.Cryptography.X509Certificates.X509FindType]::FindByThumbprint, $Certificate.Thumbprint, $false))
        $installed = $matches.Count -eq 1 -and [Convert]::ToBase64String($matches[0].RawData) -eq [Convert]::ToBase64String($Certificate.RawData)
    } finally { $store.Close() }
    $chain = [Security.Cryptography.X509Certificates.X509Chain]::new()
    try {
        # The default Windows verification and revocation policy remains enabled.
        $null = $chain.ChainPolicy.ApplicationPolicy.Add([Security.Cryptography.Oid]::new('1.3.6.1.5.5.7.3.1'))
        $chainValid = $chain.Build($Certificate)
        $statuses = @($chain.ChainStatus | ForEach-Object { $_.Status.ToString() })
    } finally { $chain.Dispose() }
    return [ordered]@{ installedInCurrentUserRoot = $installed; windowsChainValidForServerAuth = $chainValid; chainStatus = $statuses }
}

if ($Action -eq 'Prepare') {
    if (Test-Path -LiteralPath $tlsDirectory) {
        $existing = @(Get-ChildItem -Force -LiteralPath $tlsDirectory)
        if ($existing.Count -gt 0) {
            $null = Read-ManagedCertificate
        } else {
            Restrict-TlsDirectory
        }
    } else {
        New-Item -ItemType Directory -Path $tlsDirectory | Out-Null
        Restrict-TlsDirectory
    }
    if (-not (Test-Path -LiteralPath $metadataPath)) {
        $null = Invoke-OpenSsl @('req', '-x509', '-nodes', '-newkey', 'rsa:2048', '-sha256',
            '-keyout', $privateKeyPath, '-out', $certificatePath, '-days', '30',
            '-subj', '/CN=localhost/O=Khotwa AI local development',
            '-addext', 'basicConstraints=critical,CA:FALSE',
            '-addext', 'keyUsage=critical,digitalSignature,keyEncipherment',
            '-addext', 'extendedKeyUsage=serverAuth',
            '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1')
        $null = Invoke-OpenSsl @('x509', '-in', $certificatePath, '-outform', 'DER', '-out', $derPath)
        $created = [Security.Cryptography.X509Certificates.X509Certificate2]::new([IO.File]::ReadAllBytes($derPath))
        [ordered]@{
            kind = 'khotwa-v22-local-server-leaf-v1'; thumbprint = $created.Thumbprint
            derSha256 = (Get-FileHash -LiteralPath $derPath -Algorithm SHA256).Hash
            createdAt = [DateTime]::UtcNow.ToString('o'); trustInstalledByTool = $false
        } | ConvertTo-Json | Set-Content -LiteralPath $metadataPath -Encoding utf8
        $created.Dispose()
    }
}

$data = Read-ManagedCertificate
$certificate = $data.Certificate
$before = Test-CurrentUserTrust $certificate
if ($Action -eq 'Trust') {
    if (-not $before.installedInCurrentUserRoot) { Invoke-ManagedTrustImport }
    $after = Test-CurrentUserTrust $certificate
    if (-not $after.installedInCurrentUserRoot -or -not $after.windowsChainValidForServerAuth) {
        if (-not $before.installedInCurrentUserRoot) {
            Remove-ManagedTrust $certificate
        }
        throw 'Windows did not accept the exact leaf; newly added trust was rolled back. Browser protection remains enabled.'
    }
    $data.Metadata.trustInstalledByTool = $true
    $data.Metadata | ConvertTo-Json | Set-Content -LiteralPath $metadataPath -Encoding utf8
} elseif ($Action -eq 'RemoveTrust') {
    if ($before.installedInCurrentUserRoot) { Remove-ManagedTrust $certificate }
    $data.Metadata.trustInstalledByTool = $false
    $data.Metadata | ConvertTo-Json | Set-Content -LiteralPath $metadataPath -Encoding utf8
}
$after = Test-CurrentUserTrust $certificate
$acl = Get-Acl -LiteralPath $privateKeyPath
$evidence = [ordered]@{
    recordedAt = [DateTime]::UtcNow.ToString('o'); action = $Action
    scope = 'V2.2 local development only; exact server leaf trusted for current Windows user, no CA or machine-wide trust'
    thumbprint = $certificate.Thumbprint; sha256 = (Get-FileHash -LiteralPath $derPath -Algorithm SHA256).Hash
    subject = $certificate.Subject; issuer = $certificate.Issuer
    notBeforeUtc = $certificate.NotBefore.ToUniversalTime().ToString('o')
    notAfterUtc = $certificate.NotAfter.ToUniversalTime().ToString('o')
    dnsNames = @('localhost'); ipAddresses = @('127.0.0.1'); certificateAuthority = $false
    purpose = 'TLS Web Server Authentication'; privateKeyDirectoryAclRestricted = (Get-Acl -LiteralPath $tlsDirectory).AreAccessRulesProtected
    privateKeyInheritedFromRestrictedDirectory = -not $acl.AreAccessRulesProtected
    trustBefore = $before; trustAfter = $after
    browserCertificateValidationDisabled = $false; machineTrustChanged = $false; otherCertificatesChanged = $false
    privateKeyLocation = '.local/v22-tls/key.pem (ignored by Git; never included in evidence)'
    removeTrustCommand = 'pwsh -NoProfile -File tools/v22-local-https.ps1 -Action RemoveTrust'
    importMethod = 'certutil.exe -f -user -addstore Root exact managed cert.cer'
}
$history = @()
if (Test-Path -LiteralPath $evidencePath -PathType Leaf) {
    $previous = Get-Content -Raw -LiteralPath $evidencePath | ConvertFrom-Json
    if ($previous.eventHistory) { $history += @($previous.eventHistory) }
}
$history += [ordered]@{ recordedAt = $evidence.recordedAt; action = $Action; thumbprint = $certificate.Thumbprint; trustBefore = $before; trustAfter = $after }
$evidence.eventHistory = $history
New-Item -ItemType Directory -Path (Split-Path -Parent $evidencePath) -Force | Out-Null
$evidence | ConvertTo-Json -Depth 7 | Set-Content -LiteralPath $evidencePath -Encoding utf8
$evidence | ConvertTo-Json -Depth 7
$certificate.Dispose()
