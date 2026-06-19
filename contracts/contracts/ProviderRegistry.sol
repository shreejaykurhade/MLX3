// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title ProviderRegistry
/// @notice On-chain registry of compute providers for the MLX3 verifiable-agent platform.
///         A provider stakes a small amount of MON to advertise availability, sets a
///         per-job `rate`, and accrues a `jobsCompleted` counter that is bumped whenever
///         an execution attestation referencing it is submitted. The MLX3 agent reads the
///         set of active providers from this contract before it plans/executes a task.
contract ProviderRegistry {
    struct Provider {
        address owner;          // wallet that controls this provider entry
        string metadata;        // JSON blob: { name, endpoint, region, gpu, ... }
        uint256 stake;          // MON locked, in wei
        uint256 rate;           // advertised price per job, in wei
        uint256 jobsCompleted;  // incremented on each attestation
        bool active;            // whether the provider is currently accepting jobs
        uint256 registeredAt;   // block timestamp of registration
    }

    /// @notice Minimum MON stake required to register.
    uint256 public constant MIN_STAKE = 0.01 ether;

    address public owner;
    /// @notice The ExecutionAttestation contract authorized to record completed jobs.
    address public attestationContract;

    mapping(address => Provider) public providers;
    mapping(address => bool) public isRegistered;
    address[] public providerAddresses;

    event ProviderRegistered(address indexed provider, uint256 stake, uint256 rate, string metadata);
    event ProviderDeregistered(address indexed provider, uint256 refund);
    event RateUpdated(address indexed provider, uint256 oldRate, uint256 newRate);
    event MetadataUpdated(address indexed provider, string metadata);
    event ActiveStatusChanged(address indexed provider, bool active);
    event JobRecorded(address indexed provider, uint256 jobsCompleted);
    event AttestationContractUpdated(address indexed attestationContract);

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    // --------------------------------------------------------------------- //
    //                              Admin                                     //
    // --------------------------------------------------------------------- //

    /// @notice Wire the ExecutionAttestation contract so it can record completed jobs.
    function setAttestationContract(address _attestation) external onlyOwner {
        attestationContract = _attestation;
        emit AttestationContractUpdated(_attestation);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "zero owner");
        owner = newOwner;
    }

    // --------------------------------------------------------------------- //
    //                          Provider lifecycle                           //
    // --------------------------------------------------------------------- //

    /// @notice Register the caller as a provider. Requires >= MIN_STAKE of MON.
    /// @param rate Advertised price per job, in wei.
    /// @param metadata JSON description (name, endpoint, region, hardware, ...).
    function register(uint256 rate, string calldata metadata) external payable {
        require(!isRegistered[msg.sender], "already registered");
        require(msg.value >= MIN_STAKE, "insufficient stake");

        providers[msg.sender] = Provider({
            owner: msg.sender,
            metadata: metadata,
            stake: msg.value,
            rate: rate,
            jobsCompleted: 0,
            active: true,
            registeredAt: block.timestamp
        });
        isRegistered[msg.sender] = true;
        providerAddresses.push(msg.sender);

        emit ProviderRegistered(msg.sender, msg.value, rate, metadata);
    }

    function updateRate(uint256 newRate) external {
        require(isRegistered[msg.sender], "not registered");
        uint256 old = providers[msg.sender].rate;
        providers[msg.sender].rate = newRate;
        emit RateUpdated(msg.sender, old, newRate);
    }

    function updateMetadata(string calldata metadata) external {
        require(isRegistered[msg.sender], "not registered");
        providers[msg.sender].metadata = metadata;
        emit MetadataUpdated(msg.sender, metadata);
    }

    function setActive(bool active) external {
        require(isRegistered[msg.sender], "not registered");
        providers[msg.sender].active = active;
        emit ActiveStatusChanged(msg.sender, active);
    }

    /// @notice Exit the registry and refund the remaining stake.
    /// @dev Follows checks-effects-interactions: state is cleared before the transfer.
    function deregister() external {
        require(isRegistered[msg.sender], "not registered");
        Provider storage p = providers[msg.sender];
        uint256 refund = p.stake;

        p.stake = 0;
        p.active = false;
        isRegistered[msg.sender] = false;

        (bool ok, ) = msg.sender.call{value: refund}("");
        require(ok, "refund failed");

        emit ProviderDeregistered(msg.sender, refund);
    }

    /// @notice Increment a provider's completed-jobs counter.
    /// @dev Only callable by the wired ExecutionAttestation contract. Silently no-ops for
    ///      unknown providers so an attestation is never blocked by a stale reference.
    function recordJob(address provider) external {
        require(msg.sender == attestationContract, "only attestation");
        if (!isRegistered[provider]) {
            return;
        }
        providers[provider].jobsCompleted += 1;
        emit JobRecorded(provider, providers[provider].jobsCompleted);
    }

    // --------------------------------------------------------------------- //
    //                              Views                                     //
    // --------------------------------------------------------------------- //

    function getProvider(address provider) external view returns (Provider memory) {
        return providers[provider];
    }

    function getProviderCount() external view returns (uint256) {
        return providerAddresses.length;
    }

    function getAllProviderAddresses() external view returns (address[] memory) {
        return providerAddresses;
    }

    /// @notice Return every currently-active provider. Used by the agent's
    ///         `analyze_task` step to choose where to run a job.
    function getActiveProviders() external view returns (Provider[] memory) {
        uint256 count;
        for (uint256 i = 0; i < providerAddresses.length; i++) {
            if (providers[providerAddresses[i]].active) {
                count++;
            }
        }

        Provider[] memory result = new Provider[](count);
        uint256 j;
        for (uint256 i = 0; i < providerAddresses.length; i++) {
            address a = providerAddresses[i];
            if (providers[a].active) {
                result[j] = providers[a];
                j++;
            }
        }
        return result;
    }
}
