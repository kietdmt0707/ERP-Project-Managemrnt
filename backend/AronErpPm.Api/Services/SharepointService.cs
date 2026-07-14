using Azure.Identity;
using Microsoft.Graph;
using Microsoft.Graph.Models;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace AronErpPm.Api.Services
{
    public interface ISharepointService
    {
        Task<string?> CreateProjectFoldersAsync(string projectCode, string projectName, string siteId);
        Task<string?> CreateRicefwFolderAsync(string projectFolderId, string ricefwCode, string siteId);
    }

    public class SharepointService : ISharepointService
    {
        private readonly IConfiguration _configuration;
        private readonly ILogger<SharepointService> _logger;
        private GraphServiceClient? _graphClient;

        public SharepointService(IConfiguration configuration, ILogger<SharepointService> logger)
        {
            _configuration = configuration;
            _logger = logger;
            InitializeGraphClient();
        }

        private void InitializeGraphClient()
        {
            try
            {
                var tenantId = _configuration["AzureAd:TenantId"];
                var clientId = _configuration["AzureAd:ClientId"];
                var clientSecret = _configuration["AzureAd:ClientSecret"];

                if (string.IsNullOrEmpty(tenantId) || string.IsNullOrEmpty(clientId) || string.IsNullOrEmpty(clientSecret))
                {
                    _logger.LogWarning("Microsoft Graph API settings are missing. SharePoint Sync will run in Mock Mode.");
                    return;
                }

                // Configure Client Secret Credential for Daemon Application permissions
                var credential = new ClientSecretCredential(tenantId, clientId, clientSecret);
                _graphClient = new GraphServiceClient(credential);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to initialize Microsoft Graph Client.");
            }
        }

        public async Task<string?> CreateProjectFoldersAsync(string projectCode, string projectName, string siteId)
        {
            var folderName = $"{projectCode} - {projectName}";

            if (_graphClient == null)
            {
                _logger.LogInformation($"[MOCK SHAREPOINT] Created Root Project Folder on Site '{siteId}': '{folderName}'");
                return $"https://aron.sharepoint.com/teams/MockSite/SharedDocuments/{Uri.EscapeDataString(folderName)}";
            }

            try
            {
                // 1. Create root project folder in site's default document library (Drive)
                var drive = await _graphClient.Sites[siteId].Drive.GetAsync();
                if (drive?.Id == null) return null;

                var rootFolder = new DriveItem
                {
                    Name = folderName,
                    Folder = new Folder(),
                    AdditionalData = new Dictionary<string, object>
                    {
                        { "@microsoft.graph.conflictBehavior", "rename" }
                    }
                };

                var createdRoot = await _graphClient.Drives[drive.Id].Items["root"].Children.PostAsync(rootFolder);
                if (createdRoot?.Id == null) return null;

                // 2. Create subfolders for modules and deliverables
                string[] subfolders = { "01. FIN (Finance)", "02. SCM (Supply Chain)", "03. Tech & DBA (RICEFW)", "04. UAT & Deliverables" };
                foreach (var sub in subfolders)
                {
                    var childFolder = new DriveItem
                    {
                        Name = sub,
                        Folder = new Folder()
                    };
                    await _graphClient.Drives[drive.Id].Items[createdRoot.Id].Children.PostAsync(childFolder);
                }

                return createdRoot.WebUrl;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Failed to create SharePoint folders for project: {projectCode}");
                return null;
            }
        }

        public async Task<string?> CreateRicefwFolderAsync(string projectFolderId, string ricefwCode, string siteId)
        {
            if (_graphClient == null)
            {
                _logger.LogInformation($"[MOCK SHAREPOINT] Created RICEFW Folder '{ricefwCode}' under Project Folder '{projectFolderId}'");
                return $"https://aron.sharepoint.com/teams/MockSite/SharedDocuments/{projectFolderId}/{ricefwCode}";
            }

            try
            {
                var drive = await _graphClient.Sites[siteId].Drive.GetAsync();
                if (drive?.Id == null) return null;

                // Create folder specifically for a RICEFW object
                var ricefwFolder = new DriveItem
                {
                    Name = ricefwCode,
                    Folder = new Folder()
                };

                var createdFolder = await _graphClient.Drives[drive.Id].Items[projectFolderId].Children.PostAsync(ricefwFolder);
                return createdFolder?.WebUrl;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Failed to create SharePoint folder for RICEFW: {ricefwCode}");
                return null;
            }
        }
    }
}
