using System.Data.Common;
using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace AronErpPm.Api.Data
{
    public class SessionContextInterceptor : DbConnectionInterceptor
    {
        private readonly IHttpContextAccessor _httpContextAccessor;

        public SessionContextInterceptor(IHttpContextAccessor httpContextAccessor)
        {
            _httpContextAccessor = httpContextAccessor;
        }

        public override void ConnectionOpened(DbConnection connection, ConnectionEndEventData eventData)
        {
            SetSessionContext(connection);
            base.ConnectionOpened(connection, eventData);
        }

        public override Task ConnectionOpenedAsync(DbConnection connection, ConnectionEndEventData eventData, CancellationToken cancellationToken = default)
        {
            SetSessionContext(connection);
            return base.ConnectionOpenedAsync(connection, eventData, cancellationToken);
        }

        private void SetSessionContext(DbConnection connection)
        {
            var httpContext = _httpContextAccessor.HttpContext;
            if (httpContext?.User?.Identity?.IsAuthenticated == true)
            {
                var username = httpContext.User.FindFirst(ClaimTypes.Name)?.Value;
                var role = httpContext.User.FindFirst(ClaimTypes.Role)?.Value;

                if (!string.IsNullOrEmpty(username) && !string.IsNullOrEmpty(role))
                {
                    // Execute PostgreSQL session config setter
                    using var command = connection.CreateCommand();
                    command.CommandText = @"
                        SELECT set_config('app.current_username', @username, true);
                        SELECT set_config('app.current_user_role', @role, true);
                    ";
                    
                    var usernameParam = command.CreateParameter();
                    usernameParam.ParameterName = "@username";
                    usernameParam.Value = username;

                    var roleParam = command.CreateParameter();
                    roleParam.ParameterName = "@role";
                    roleParam.Value = role;
                    
                    command.Parameters.Add(usernameParam);
                    command.Parameters.Add(roleParam);
                    
                    command.ExecuteNonQuery();
                }
            }
        }
    }
}
